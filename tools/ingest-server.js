// The "Add songs" back end: a Vite dev-server plugin that runs tools/analyze.py for the app.
// Dev only (`npm run dev`): the deployed site is static and never analyzes anything.
//
//   GET    /api/ingest                 { available, reason?, jobs }   (the app polls this)
//   POST   /api/ingest/link            { url, force? }        one job per link in `url`
//   POST   /api/ingest/file?name=&force=   (the file as the body)  one job
//   DELETE /api/ingest/jobs/<id>       cancel a queued job or stop a running one
//   GET    /local-songs/<file>         songs analyzed from files, and their audio (with Range)
//
// Jobs run one at a time (the models use every core), oldest first. A job's progress comes
// from the "» <stage>" lines analyze.py prints. Uploads go to a temporary folder; analyze.py
// copies the file into local-songs/, which is gitignored, so audio never reaches the site.
//
// Settings (environment): CHORD_PYTHON, the venv's python (default ~/chord-env/bin/python);
// BEAT_THIS_CHECKPOINT, a local Beat This! checkpoint (default ~/Downloads/final0.ckpt if there).

import { spawn } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const LOCAL_DIR = join(ROOT, 'local-songs')
const PYTHON = process.env.CHORD_PYTHON || join(homedir(), 'chord-env', 'bin', 'python')
const CHECKPOINT = process.env.BEAT_THIS_CHECKPOINT
    || [join(homedir(), 'Downloads', 'final0.ckpt')].find(p => existsSync(p))

const MAX_UPLOAD = 300 * 1024 * 1024
const KEEP_JOBS = 50
const LOG_LINES = 40

const TYPES = {
    '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
    '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
    '.flac': 'audio/flac', '.webm': 'audio/webm',
}
export const AUDIO_EXTENSIONS = Object.keys(TYPES).filter(e => e !== '.json')

// The video id in a YouTube URL (watch, youtu.be, shorts, embed, live) or a bare id, or null.
// The same rule as analyze.py's video_id_from.
export function videoIdIn(text) {
    if (/^[\w-]{11}$/.test(text)) return /[\dA-Z_-]/.test(text) ? text : null  // not a plain word
    if (!/youtu\.?be/.test(text)) return null
    return /(?:[?&]v=|youtu\.be\/|\/(?:shorts|embed|live|v)\/)([\w-]{11})(?![\w-])/.exec(text)?.[1] ?? null
}

// The videos in whatever was pasted, as ids: in order, each once however it was linked.
export function linksIn(text) {
    // a URL ends at whitespace, a comma, or where another URL starts (links pasted with no gap)
    const found = String(text ?? '').match(/https?:\/\/(?:(?!https?:\/\/)[^\s,])+|\b[\w-]{11}\b/g) ?? []
    return [...new Set(found.map(videoIdIn).filter(Boolean))]
}

function createQueue() {
    const jobs = []
    let running = null
    let nextId = 1

    const view = (job) => {
        const { process: _p, upload: _u, ...rest } = job
        return rest
    }

    const finish = (job, status, error) => {
        job.status = status
        job.error = error ?? null
        job.finishedAt = Date.now()
        if (job.upload) rmSync(job.upload, { recursive: true, force: true })
        running = null
        while (jobs.length > KEEP_JOBS) {
            const i = jobs.findIndex(j => j.status !== 'queued' && j.status !== 'running')
            if (i < 0) break
            jobs.splice(i, 1)
        }
        runNext()
    }

    function runNext() {
        if (running) return
        const job = jobs.find(j => j.status === 'queued')
        if (!job) return
        running = job
        job.status = 'running'
        job.startedAt = Date.now()
        job.stage = 'starting'

        const args = [join(ROOT, 'tools', 'analyze.py')]
        // A file's title comes from its tags, or else its name (the upload keeps the name).
        if (job.kind === 'file') args.push('--file', job.path)
        else args.push(job.input)
        if (job.force) args.push('--force')
        if (CHECKPOINT) args.push('--checkpoint', CHECKPOINT)

        let child
        try {
            child = spawn(PYTHON, args, { cwd: ROOT, env: { ...process.env, PYTHONUNBUFFERED: '1' } })
        } catch (e) {
            finish(job, 'failed', `Could not start the analysis: ${e.message}`)
            return
        }
        job.process = child
        let lastError = ''
        const onLines = (chunk, isErr) => {
            for (const raw of String(chunk).split(/\r?\n|\r/)) {
                const line = raw.trim()
                if (!line || /^\[download\]|^Inference:/.test(line)) continue
                job.log.push(line)
                if (job.log.length > LOG_LINES) job.log.shift()
                const stage = /^» (.+)$/.exec(line)
                if (stage) {
                    const song = /^(saved|exists) (\S+)$/.exec(stage[1])
                    if (song) {
                        job.songId = song[2]
                        job.exists = song[1] === 'exists'
                    } else job.stage = stage[1]
                    continue
                }
                const titled = /^(.+) \((\d+)s\)(?:\s+\[.*\])?$/.exec(line)
                if (titled && !job.titleFromTool) {
                    job.title = titled[1]
                    job.titleFromTool = true
                }
                if (isErr && !/warning/i.test(line)) lastError = line
            }
        }
        child.stdout.on('data', c => onLines(c, false))
        child.stderr.on('data', c => onLines(c, true))
        child.on('error', e => {
            if (job.status === 'running') finish(job, 'failed', `Could not start the analysis: ${e.message}`)
        })
        child.on('close', (code, signal) => {
            if (job.status !== 'running') return
            if (job.cancelled) finish(job, 'cancelled')
            else if (code === 0 && job.songId) finish(job, 'done')
            else finish(job, 'failed', lastError || `The analysis stopped (${signal ?? `exit ${code}`}).`)
        })
    }

    return {
        list: () => jobs.map(view),
        add(fields) {
            const job = {
                id: String(nextId++), status: 'queued', stage: null, title: fields.input, songId: null,
                error: null, log: [], createdAt: Date.now(), startedAt: null, finishedAt: null, ...fields,
            }
            jobs.push(job)
            runNext()
            return view(job)
        },
        cancel(id) {
            const job = jobs.find(j => j.id === id)
            if (!job) return false
            if (job.status === 'queued') {
                job.status = 'cancelled'
                job.finishedAt = Date.now()
                if (job.upload) rmSync(job.upload, { recursive: true, force: true })
            } else if (job.status === 'running') {
                job.cancelled = true
                job.process?.kill('SIGTERM')
            }
            return true
        },
    }
}

const sendJson = (res, status, body) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(body))
}

function readBody(req, limit) {
    return new Promise((resolveBody, reject) => {
        let size = 0
        const parts = []
        req.on('data', c => {
            size += c.length
            if (size > limit) {
                reject(new Error('too large'))
                req.destroy()
            } else parts.push(c)
        })
        req.on('end', () => resolveBody(Buffer.concat(parts).toString('utf8')))
        req.on('error', reject)
    })
}

function saveUpload(req, name) {
    return new Promise((resolveUpload, reject) => {
        const dir = mkdtempSync(join(tmpdir(), 'penta-upload-'))
        const path = join(dir, basename(name).replace(/[^\w.\- ()]/g, '_') || 'audio')
        const out = createWriteStream(path)
        let size = 0
        const fail = (e) => {
            out.destroy()
            rmSync(dir, { recursive: true, force: true })
            reject(e)
        }
        req.on('data', c => {
            size += c.length
            if (size > MAX_UPLOAD) {
                req.destroy()
                fail(new Error(`The file is over ${MAX_UPLOAD / 1024 / 1024} MB.`))
            }
        })
        req.on('error', fail)
        req.pipe(out)
        out.on('finish', () => (size ? resolveUpload({ dir, path }) : fail(new Error('The file is empty.'))))
        out.on('error', fail)
    })
}

// A file from local-songs/, with Range support so the audio player can seek.
function serveLocal(req, res, name) {
    const ext = extname(name).toLowerCase()
    if (!/^[\w-]+\.[a-z0-9]+$/i.test(name) || !TYPES[ext]) return false
    const path = join(LOCAL_DIR, name)
    if (!existsSync(path)) return false
    const { size } = statSync(path)
    res.setHeader('Content-Type', TYPES[ext])
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'no-cache')
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
    if (range && (range[1] || range[2])) {
        let start = range[1] ? Number(range[1]) : size - Number(range[2])
        let end = range[1] && range[2] ? Number(range[2]) : size - 1
        start = Math.max(0, start)
        end = Math.min(end, size - 1)
        if (start > end) {
            res.statusCode = 416
            res.setHeader('Content-Range', `bytes */${size}`)
            res.end()
            return true
        }
        res.statusCode = 206
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
        res.setHeader('Content-Length', end - start + 1)
        createReadStream(path, { start, end }).pipe(res)
    } else {
        res.setHeader('Content-Length', size)
        createReadStream(path).pipe(res)
    }
    return true
}

export default function ingest() {
    const queue = createQueue()
    const available = existsSync(PYTHON)
    const reason = available ? null
        : `The analysis tool's Python was not found at ${PYTHON}. Set CHORD_PYTHON to the venv's python.`

    return {
        name: 'song-ingest',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url, 'http://local')
                const path = url.pathname
                try {
                    if (path.startsWith('/local-songs/') && req.method === 'GET') {
                        if (serveLocal(req, res, decodeURIComponent(path.slice('/local-songs/'.length)))) return
                        if (path.endsWith('index.json')) return sendJson(res, 200, [])
                        return sendJson(res, 404, { error: 'not found' })
                    }
                    if (!path.startsWith('/api/ingest')) return next()

                    if (path === '/api/ingest' && req.method === 'GET') {
                        return sendJson(res, 200, { available, reason, jobs: queue.list() })
                    }
                    if (!available) return sendJson(res, 503, { error: reason })

                    if (path === '/api/ingest/link' && req.method === 'POST') {
                        const body = JSON.parse((await readBody(req, 64 * 1024)) || '{}')
                        const links = linksIn(body.url)
                        if (!links.length) return sendJson(res, 400, { error: 'No YouTube link found.' })
                        const jobs = links.map(input => queue.add({ kind: 'link', input, force: Boolean(body.force) }))
                        return sendJson(res, 200, { jobs })
                    }
                    if (path === '/api/ingest/file' && req.method === 'POST') {
                        const name = url.searchParams.get('name') || 'audio'
                        if (!AUDIO_EXTENSIONS.includes(extname(name).toLowerCase())) {
                            return sendJson(res, 400, { error: `Not an audio file: ${name}` })
                        }
                        const upload = await saveUpload(req, name)
                        const title = basename(name, extname(name))
                        const job = queue.add({
                            kind: 'file', input: name, title, path: upload.path, upload: upload.dir,
                            force: url.searchParams.get('force') === '1',
                        })
                        return sendJson(res, 200, { jobs: [job] })
                    }
                    const cancel = /^\/api\/ingest\/jobs\/(\w+)$/.exec(path)
                    if (cancel && req.method === 'DELETE') {
                        return sendJson(res, queue.cancel(cancel[1]) ? 200 : 404, {})
                    }
                    return sendJson(res, 404, { error: 'not found' })
                } catch (e) {
                    return sendJson(res, 400, { error: e.message })
                }
            })
        },
    }
}
