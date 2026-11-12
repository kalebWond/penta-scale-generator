import { useCallback, useEffect, useMemo, useState } from 'react'
import { withEdit } from './corrections'

// Musicians' corrections, on the page. Published corrections come from the corrections endpoint
// (a Netlify Function on the live site, the dev server locally; netlify/shared/review.js), or,
// if it can't be reached, from the song's own file (tools/sync_corrections.py copies them in).

const ENDPOINT = '/.netlify/functions/corrections'
const newer = (a, b) => (!a ? b : !b ? a : (a.at ?? '') >= (b.at ?? '') ? a : b)

// The published corrections for a song: { corrections, loaded, reload }.
export function usePublishedCorrections(songId, fromFile) {
    const [live, setLive] = useState({ songId: null, data: null })
    const [version, setVersion] = useState(0)
    useEffect(() => {
        if (!songId) return undefined
        let ignore = false
        const done = (data) => { if (!ignore) setLive({ songId, data }) }
        fetch(`${ENDPOINT}?song=${songId}`)
            .then(res => (res.ok && res.headers.get('content-type')?.includes('json') ? res.json() : null))
            .then(done, () => done(null))
        return () => { ignore = true }
    }, [songId, version])
    const reload = useCallback(() => setVersion(v => v + 1), [])
    const loaded = live.songId === songId
    return { corrections: newer(loaded ? live.data : null, fromFile ?? null), loaded, reload }
}

// The review link's token for this song, if the page was opened from one. It's kept for the
// browser session, per song, so moving around the app doesn't lose it, and a link for one song
// doesn't turn on editing for another.
export function useReviewToken(songId) {
    return useMemo(() => {
        if (!songId) return null
        const key = `review:${songId}`
        try {
            const fromUrl = new URLSearchParams(window.location.search).get('review')
            if (fromUrl) sessionStorage.setItem(key, fromUrl)
            return sessionStorage.getItem(key)
        } catch {
            return new URLSearchParams(window.location.search).get('review')
        }
    }, [songId])
}

const EMPTY = { edits: [], details: {}, note: '' }
const draftKey = (songId) => `review.draft:${songId}`

function loadDraft(songId, published) {
    try {
        const saved = JSON.parse(localStorage.getItem(draftKey(songId)) ?? 'null')
        if (saved) return saved
    } catch { /* no storage: start from what's published */ }
    return published
        ? { edits: published.edits ?? [], details: published.details ?? {}, note: published.note ?? '' }
        : EMPTY
}

// The musician's draft: starts from what's published, keeps every step for undo and redo, and is
// saved in this browser so closing the tab loses nothing. Submitting publishes it.
// `ready`: the published corrections have loaded (the draft must start from them, or publishing
// would drop them).
export function useDraft(songId, token, published, ready, onPublished) {
    const [history, setHistory] = useState(() => ({ past: [], now: EMPTY, future: [] }))
    const [loadedFor, setLoadedFor] = useState(null)
    const [status, setStatus] = useState({ sending: false, error: null, sentAt: null })

    // Start from the saved draft or the published corrections, once they're known.
    useEffect(() => {
        if (!token || !ready || loadedFor === songId) return
        setHistory({ past: [], now: loadDraft(songId, published), future: [] })
        setLoadedFor(songId)
    }, [songId, token, published, ready, loadedFor])

    const draft = history.now
    useEffect(() => {
        if (!token || loadedFor !== songId) return
        try { localStorage.setItem(draftKey(songId), JSON.stringify(draft)) } catch { /* fine */ }
    }, [draft, songId, token, loadedFor])

    const change = useCallback((next) => setHistory(h => ({ past: [...h.past, h.now].slice(-200), now: next(h.now), future: [] })), [])
    const setEdit = useCallback((edit) => change(d => ({ ...d, edits: withEdit(d.edits, edit) })), [change])
    const setDetails = useCallback((fields) => change(d => ({ ...d, details: { ...d.details, ...fields } })), [change])
    const setNote = useCallback((note) => setHistory(h => ({ ...h, now: { ...h.now, note } })), [])
    const undo = useCallback(() => setHistory(h => (h.past.length
        ? { past: h.past.slice(0, -1), now: h.past.at(-1), future: [h.now, ...h.future] } : h)), [])
    const redo = useCallback(() => setHistory(h => (h.future.length
        ? { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1) } : h)), [])

    const submit = useCallback(async () => {
        setStatus({ sending: true, error: null, sentAt: null })
        try {
            const res = await fetch(`${ENDPOINT}?song=${songId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ review: token, ...draft }),
            })
            const body = res.headers.get('content-type')?.includes('json') ? await res.json() : null
            if (!res.ok) throw new Error(body?.error ?? `The corrections could not be sent (HTTP ${res.status}).`)
            try { localStorage.removeItem(draftKey(songId)) } catch { /* fine */ }
            setStatus({ sending: false, error: null, sentAt: body?.at ?? new Date().toISOString() })
            onPublished?.()
        } catch (e) {
            setStatus({ sending: false, error: e.message, sentAt: null })
        }
    }, [songId, token, draft, onPublished])

    return {
        ready: loadedFor === songId, draft, setEdit, setDetails, setNote, undo, redo, submit, status,
        canUndo: history.past.length > 0, canRedo: history.future.length > 0,
    }
}
