// Every page of the app, as data. Routes, page titles and the home screen's cards are all built
// from this list, so adding a feature means a folder under src/features/, an entry here (with a
// `card` so it shows on the home screen), and its component in App.jsx's FEATURE_COMPONENTS.
// Kept free of components so routing can be tested on its own.

const VIDEO_ID = /^[\w-]{11}$/

export const FEATURES = [
    {
        id: 'home',
        path: '/',
        title: 'PentaScales · Ethiopian pentatonic scales on an interactive piano',
    },
    {
        id: 'songs',
        // Song data is /songs/<videoId>.json; a page path never ends in .json, so they can't clash.
        path: '/songs',
        title: 'Songs · PentaScales',
        // A song page is /songs/<videoId>; anything else after the slash is the song list.
        isParam: (segment) => VIDEO_ID.test(segment),
        card: {
            label: 'Songs',
            icon: 'songs',
            description: 'Chords for Ethiopian songs, in time with the video.',
        },
    },
    {
        id: 'scales',
        path: '/scales',
        title: 'Scales · PentaScales',
        card: {
            label: 'Scales',
            icon: 'scales',
            description: 'Play Tizita, Bati, Ambasel and Anchi hoye in any key, from any note.',
        },
    },
    {
        id: 'quiz',
        path: '/quiz',
        title: 'Ear training quiz · PentaScales',
        card: {
            label: 'Quiz',
            icon: 'quiz',
            description: 'Hear a scale and name it. It gets harder as you get better.',
        },
    },
]

export const HOME = 'home'

const byId = new Map(FEATURES.map(f => [f.id, f]))

export const getFeature = (id) => byId.get(id)

// The features that get a card on the home screen, in order.
export const CARDS = FEATURES.filter(f => f.card)
