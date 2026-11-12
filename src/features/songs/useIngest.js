import { useCallback, useEffect, useRef, useState } from 'react'
import { refreshSongs } from './useSongs'

// The "Add songs" panel's link to the dev server's analysis queue (tools/ingest-server.js).
// It's polled once a second while anything is queued or running. When a song finishes, the song
// list reloads. `available` is false when there is no analysis server (a production build or
// `vite preview`), and the panel stays hidden.

const POLL_MS = 1000

async function api(path, options) {
    const res = await fetch(path, options)
    if (!res.headers.get('content-type')?.includes('json')) throw new Error('no analysis server')
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
    return body
}

export function useIngest() {
    const [state, setState] = useState({ available: false, reason: null, jobs: [] })
    const [uploads, setUploads] = useState([])     // files on their way to the server
    const [error, setError] = useState(null)
    const done = useRef(null)                      // ids of jobs already seen finished

    const load = useCallback(async () => {
        try {
            const body = await api('/api/ingest')
            const finished = body.jobs.filter(j => j.status === 'done').map(j => j.id)
            if (done.current && finished.some(id => !done.current.has(id))) refreshSongs()
            done.current = new Set(finished)
            setState({ available: body.available, reason: body.reason, jobs: body.jobs })
        } catch {
            setState(s => ({ ...s, available: false }))
        }
    }, [])

    useEffect(() => { load() }, [load])

    const busy = uploads.length > 0 || state.jobs.some(j => j.status === 'queued' || j.status === 'running')
    useEffect(() => {
        if (!busy) return undefined
        const timer = setInterval(load, POLL_MS)
        return () => clearInterval(timer)
    }, [busy, load])

    const run = useCallback(async (request) => {
        setError(null)
        try {
            await request()
        } catch (e) {
            setError(e.message)
        }
        load()
    }, [load])

    const addLinks = useCallback((text, force) => run(() => api('/api/ingest/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: text, force }),
    })), [run])

    const addFiles = useCallback((files, force) => run(async () => {
        for (const file of files) {
            const key = `${file.name}-${file.size}-${Date.now()}`
            setUploads(u => [...u, { key, name: file.name }])
            try {
                const query = new URLSearchParams({ name: file.name, force: force ? '1' : '0' })
                await api(`/api/ingest/file?${query}`, { method: 'POST', body: file })
            } finally {
                setUploads(u => u.filter(x => x.key !== key))
            }
        }
    }), [run])

    const cancel = useCallback((id) => run(() => api(`/api/ingest/jobs/${id}`, { method: 'DELETE' })), [run])

    return { ...state, uploads, error, addLinks, addFiles, cancel }
}
