import { useCallback, useEffect, useState } from 'react'

// Practice lives at /, the quiz at /quiz, song chords at /chords (the list) and
// /chords/<videoId> (one song). No router: one path to read and the History API to change it,
// so links work and the back button goes back. (Netlify serves index.html for these paths
// via public/_redirects. The song data itself is at /songs/<videoId>.json, a different path.)
const PAGES = {
    practice: {
        path: '/',
        title: 'PentaScales · Ethiopian pentatonic scales on an interactive piano',
    },
    quiz: {
        path: '/quiz',
        title: 'Ear training quiz · PentaScales',
    },
    chords: {
        path: '/chords',
        title: 'Song chords · PentaScales',
    },
}

const VIDEO_ID = /^[\w-]{11}$/

export function routeFromPath(pathname) {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 1 && parts[0] === 'quiz') return { mode: 'quiz', songId: null }
    if (parts[0] === 'chords' && parts.length <= 2) {
        return { mode: 'chords', songId: VIDEO_ID.test(parts[1] ?? '') ? parts[1] : null }
    }
    return { mode: 'practice', songId: null }
}

export const pathFor = (mode, songId) => mode === 'chords' && songId ? `/chords/${songId}` : PAGES[mode].path

export const pageTitle = (mode) => PAGES[mode].title

const currentRoute = () => routeFromPath(window.location.pathname)

export function useMode() {
    const [route, setRoute] = useState(currentRoute)

    useEffect(() => {
        const onPop = () => setRoute(currentRoute())
        window.addEventListener('popstate', onPop)
        return () => window.removeEventListener('popstate', onPop)
    }, [])

    // Title and canonical follow the page, so a shared /quiz link isn't treated as a copy of /.
    // (A song page sets its own title once the song has loaded.)
    useEffect(() => {
        document.title = PAGES[route.mode].title
        const canonical = document.querySelector('link[rel="canonical"]')
        if (canonical) canonical.href = new URL(pathFor(route.mode, route.songId), canonical.href).href
    }, [route.mode, route.songId])

    const go = useCallback((mode, songId = null) => {
        const now = currentRoute()
        if (now.mode === mode && now.songId === songId) return
        window.history.pushState(null, '', pathFor(mode, songId) + window.location.search)
        setRoute({ mode, songId })
    }, [])

    return [route.mode, go, route.songId]
}
