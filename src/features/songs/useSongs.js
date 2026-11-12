import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { withManual } from './timeline'

// Song data is static JSON written by tools/analyze.py: songs from YouTube in public/songs/
// (deployed with the site), songs from local audio files in local-songs/, which only the dev
// server serves (tools/ingest-server.js). On the deployed site there are no local songs.
const LOCAL = import.meta.env.DEV
const cache = new Map()

// Bumped when songs are added (the "Add songs" panel), so the lists and songs load again.
let version = 0
const listeners = new Set()
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export function refreshSongs() {
    cache.clear()
    version += 1
    listeners.forEach(fn => fn())
}
const useVersion = () => useSyncExternalStore(subscribe, () => version)

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

// The first of `urls` that loads; the error of the first if none do.
async function getFirstJson(urls) {
    let firstError
    for (const url of urls) {
        try {
            return await getJson(url)
        } catch (e) {
            firstError ??= e
        }
    }
    throw firstError
}

// The song list: YouTube songs, then (dev only) songs from files, each marked with its source.
async function getSongList() {
    const [web, local] = await Promise.all([
        getJson('/songs/index.json'),
        LOCAL ? getJson('/local-songs/index.json').catch(() => []) : [],
    ])
    return [...web, ...local.map(s => ({ ...s, source: 'file' }))]
}

function useLoad(key, load) {
    const v = useVersion()
    const [state, setState] = useState({ data: null, error: null, loading: Boolean(key) })
    useEffect(() => {
        if (!key) {
            setState({ data: null, error: null, loading: false })
            return
        }
        let ignore = false
        // a refresh keeps showing what's there while it loads again
        setState(s => ({ data: s.key === key ? s.data : null, error: null, loading: s.key !== key, key }))
        load().then(
            data => { if (!ignore) setState({ data, error: null, loading: false, key }) },
            error => { if (!ignore) setState({ data: null, error: error.message, loading: false, key }) },
        )
        return () => { ignore = true }
    }, [key, v])   // `load` is a new function each render; what it loads is named by `key`
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
export const useSongIndex = (enabled) => useWithManual(useLoad(enabled ? 'index' : null, getSongList), applyToList)

// One song: from public/songs/, or (dev) from local-songs/, where a song from a file also has
// its audio ("audio": the file's name there).
export const useSong = (songId) => useWithManual(useLoad(songId, () => getFirstJson(
    LOCAL ? [`/songs/${songId}.json`, `/local-songs/${songId}.json`] : [`/songs/${songId}.json`],
)), withManual)

// Where a song's own audio is served (songs from files only).
export const audioUrl = (song) => (song?.source === 'file' && song.audio ? `/local-songs/${song.audio}` : null)
