import { useEffect, useMemo, useState } from 'react'
import { withManual } from './timeline'

// Song data is static JSON written by tools/analyze.py into public/songs/.
const cache = new Map()

function getJson(url) {
    if (!cache.has(url)) {
        const request = fetch(url).then(res => {
            if (!res.ok) throw new Error(res.status === 404 ? 'not found' : `HTTP ${res.status}`)
            // A missing file comes back as the app's own index.html (the SPA fallback), not a 404.
            if (!res.headers.get('content-type')?.includes('json')) throw new Error('not found')
            return res.json()
        })
        request.catch(() => cache.delete(url))    // a failed load can be retried
        cache.set(url, request)
    }
    return cache.get(url)
}

function useJson(url) {
    const [state, setState] = useState({ data: null, error: null, loading: Boolean(url) })
    useEffect(() => {
        if (!url) {
            setState({ data: null, error: null, loading: false })
            return
        }
        let ignore = false
        setState({ data: null, error: null, loading: true })
        getJson(url).then(
            data => { if (!ignore) setState({ data, error: null, loading: false }) },
            error => { if (!ignore) setState({ data: null, error: error.message, loading: false }) },
        )
        return () => { ignore = true }
    }, [url])
    return state
}

// Songs come out with their manual settings applied (a meter or a scale set by hand), so
// nothing downstream has to know about them.
const useWithManual = (state, apply) => {
    const data = useMemo(() => (state.data ? apply(state.data) : state.data), [state.data, apply])
    return data === state.data ? state : { ...state, data }
}
const applyToList = (songs) => songs.map(withManual)

// The song list, only fetched while it's needed.
export const useSongIndex = (enabled) => useWithManual(useJson(enabled ? '/songs/index.json' : null), applyToList)

export const useSong = (videoId) => useWithManual(useJson(videoId ? `/songs/${videoId}.json` : null), withManual)
