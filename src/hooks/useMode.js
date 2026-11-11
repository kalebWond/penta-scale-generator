import { useCallback, useEffect, useState } from 'react'

// Practice lives at /, the quiz at /quiz. No router: one path to read and the History API to
// change it, so links to /quiz work and the back button leaves the quiz. (Netlify serves
// index.html for /quiz via public/_redirects.)
const PAGES = {
    practice: {
        path: '/',
        title: 'PentaScales · Ethiopian pentatonic scales on an interactive piano',
    },
    quiz: {
        path: '/quiz',
        title: 'Ear training quiz · PentaScales',
    },
}

const modeFromPath = () => window.location.pathname.replace(/\/+$/, '') === '/quiz' ? 'quiz' : 'practice'

export function useMode() {
    const [mode, setMode] = useState(modeFromPath)

    useEffect(() => {
        const onPop = () => setMode(modeFromPath())
        window.addEventListener('popstate', onPop)
        return () => window.removeEventListener('popstate', onPop)
    }, [])

    // Title and canonical follow the page, so a shared /quiz link isn't treated as a copy of /.
    useEffect(() => {
        document.title = PAGES[mode].title
        const canonical = document.querySelector('link[rel="canonical"]')
        if (canonical) canonical.href = new URL(PAGES[mode].path, canonical.href).href
    }, [mode])

    const go = useCallback((next) => {
        if (next === modeFromPath()) return
        window.history.pushState(null, '', PAGES[next].path + window.location.search)
        setMode(next)
    }, [])

    return [mode, go]
}
