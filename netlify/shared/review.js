// Musicians' chord corrections: share links, and reading and storing corrections. Used by the
// live site's function (netlify/functions/corrections.mjs, Netlify Blobs) and by the dev server
// (tools/ingest-server.js, a local folder), so both behave the same.
//
//   GET  /.netlify/functions/corrections?song=<id>    the song's corrections, or null
//   GET  /.netlify/functions/corrections?all=1        { <id>: corrections } (tools/sync_corrections.py)
//   POST /.netlify/functions/corrections?song=<id>    { review: <token>, edits, details, note }
//
// A share link is /songs/<id>?review=<name>~<signature>: the signature is an HMAC of the song
// and the name with REVIEW_SECRET, so a link works for its own song only, there's no list of
// musicians to keep, and nobody can make a link without the secret. Submitting publishes at
// once (one musician per song: a new submission replaces the last); every submission is also
// kept in the history.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { validateSubmission } from '../../src/features/songs/corrections.js'

const SONG_ID = /^[\w-]{11}$/
const NAME = /^[\p{L}\p{N} .'-]{1,40}$/u

const signature = (secret, songId, name) =>
    createHmac('sha256', secret).update(`${songId}:${name}`).digest('base64url').slice(0, 22)

// The token for a share link.
export function reviewToken(secret, songId, name) {
    const clean = String(name ?? '').trim()
    if (!secret) throw new Error('REVIEW_SECRET is not set')
    if (!SONG_ID.test(songId) || !NAME.test(clean)) throw new Error('Bad song id or name')
    return `${clean}~${signature(secret, songId, clean)}`
}

// The musician's name if the token is good for this song, else null.
export function checkToken(secret, songId, token) {
    if (!secret || typeof token !== 'string') return null
    const cut = token.lastIndexOf('~')
    if (cut < 1) return null
    const name = token.slice(0, cut)
    const given = Buffer.from(token.slice(cut + 1))
    const wanted = Buffer.from(signature(secret, songId, name))
    return given.length === wanted.length && timingSafeEqual(given, wanted) ? name : null
}

const json = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

// store: { get(key) -> object | null, set(key, object), list(prefix) -> [key] }
export async function handleCorrections(request, { store, secret }) {
    const url = new URL(request.url)
    const songId = url.searchParams.get('song')

    if (request.method === 'GET') {
        if (url.searchParams.get('all')) {
            const out = {}
            for (const key of await store.list('current/')) out[key.slice('current/'.length)] = await store.get(key)
            return json(200, out)
        }
        if (!SONG_ID.test(songId ?? '')) return json(400, { error: 'Which song?' })
        return json(200, (await store.get(`current/${songId}`)) ?? null)
    }

    if (request.method === 'POST') {
        if (!SONG_ID.test(songId ?? '')) return json(400, { error: 'Which song?' })
        let body
        try {
            body = await request.json()
        } catch {
            return json(400, { error: 'The submission could not be read.' })
        }
        const by = checkToken(secret, songId, body?.review)
        if (!by) return json(403, { error: 'This review link is not valid for this song.' })
        const { value, error } = validateSubmission(body)
        if (error) return json(400, { error })
        const at = new Date().toISOString()
        const record = { songId, by, at, ...value }
        await store.set(`history/${songId}/${at}`, record)
        await store.set(`current/${songId}`, record)
        return json(200, record)
    }

    return json(405, { error: 'GET or POST' })
}
