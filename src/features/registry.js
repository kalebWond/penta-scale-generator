// Every feature of the app, as data. Routes, page titles and navigation are all built from this
// list, so adding a feature means a folder under src/features/, an entry here, and its component
// in App.jsx's FEATURE_COMPONENTS. Kept free of components so routing can be tested on its own.

const VIDEO_ID = /^[\w-]{11}$/

export const FEATURES = [
    {
        id: 'scales',
        path: '/',
        label: 'Practice',
        title: 'PentaScales · Ethiopian pentatonic scales on an interactive piano',
    },
    {
        id: 'quiz',
        path: '/quiz',
        label: 'Quiz',
        title: 'Ear training quiz · PentaScales',
    },
    {
        id: 'songs',
        path: '/chords',
        label: 'Chords',
        title: 'Song chords · PentaScales',
        // A song page is /chords/<videoId>; anything else after the slash is the song list.
        isParam: (segment) => VIDEO_ID.test(segment),
    },
]

export const DEFAULT_FEATURE = 'scales'

const byId = new Map(FEATURES.map(f => [f.id, f]))

export const getFeature = (id) => byId.get(id)
