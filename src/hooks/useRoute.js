import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_FEATURE, FEATURES, getFeature } from '../features/registry'

// No router: one path to read and the History API to change it, so links work and the back
// button goes back. A route is { id, param }: the feature, and an optional path segment after
// it (a song's video id). Netlify serves index.html for every path via public/_redirects.

export function routeFromPath(pathname) {
    const parts = pathname.split('/').filter(Boolean)
    const feature = FEATURES.find(f => f.path === `/${parts[0] ?? ''}`)
    if (feature && parts.length <= 1) return { id: feature.id, param: null }
    if (feature?.isParam && parts.length === 2) {
        return { id: feature.id, param: feature.isParam(parts[1]) ? parts[1] : null }
    }
    return { id: DEFAULT_FEATURE, param: null }
}

export function pathFor(id, param = null) {
    const { path, isParam } = getFeature(id)
    return isParam && param ? `${path.replace(/\/$/, '')}/${param}` : path
}

const currentRoute = () => routeFromPath(window.location.pathname)

export function useRoute() {
    const [route, setRoute] = useState(currentRoute)

    useEffect(() => {
        const onPop = () => setRoute(currentRoute())
        window.addEventListener('popstate', onPop)
        return () => window.removeEventListener('popstate', onPop)
    }, [])

    // Title and canonical follow the page, so a shared /quiz link isn't treated as a copy of /.
    // (A song page sets its own title once the song has loaded.)
    useEffect(() => {
        document.title = getFeature(route.id).title
        const canonical = document.querySelector('link[rel="canonical"]')
        if (canonical) canonical.href = new URL(pathFor(route.id, route.param), canonical.href).href
    }, [route.id, route.param])

    const go = useCallback((id, param = null) => {
        const now = currentRoute()
        if (now.id === id && now.param === param) return
        window.history.pushState(null, '', pathFor(id, param) + window.location.search)
        setRoute({ id, param })
    }, [])

    return [route, go]
}
