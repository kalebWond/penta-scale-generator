import { CARDS, FEATURES } from '../features/registry'
import { pathFor, routeFromPath } from './useRoute'

const ID = 'CocA4mTVKw4'

describe('routes', () => {
    test('home and each feature at its path', () => {
        expect(routeFromPath('/')).toEqual({ id: 'home', param: null })
        expect(routeFromPath('/scales')).toEqual({ id: 'scales', param: null })
        expect(routeFromPath('/quiz')).toEqual({ id: 'quiz', param: null })
        expect(routeFromPath('/quiz/')).toEqual({ id: 'quiz', param: null })
        expect(routeFromPath('/songs')).toEqual({ id: 'songs', param: null })
        expect(routeFromPath(`/songs/${ID}`)).toEqual({ id: 'songs', param: ID })
        expect(routeFromPath(`/songs/${ID}/`)).toEqual({ id: 'songs', param: ID })
    })

    test('anything else is home; a bad song id is the song list', () => {
        expect(routeFromPath('/nope')).toEqual({ id: 'home', param: null })
        expect(routeFromPath('/chords')).toEqual({ id: 'home', param: null })
        expect(routeFromPath('/quiz/extra')).toEqual({ id: 'home', param: null })
        expect(routeFromPath('/songs/not-an-id')).toEqual({ id: 'songs', param: null })
        expect(routeFromPath('/songs/a/b')).toEqual({ id: 'home', param: null })
    })

    test('a song page path is never a song data file', () => {
        // The data is /songs/<id>.json and /songs/index.json: neither reads as a song page.
        expect(routeFromPath(`/songs/${ID}.json`)).toEqual({ id: 'songs', param: null })
        expect(routeFromPath('/songs/index.json')).toEqual({ id: 'songs', param: null })
        expect(pathFor('songs', ID).endsWith('.json')).toBe(false)
    })

    test('paths round-trip for every page', () => {
        expect(pathFor('home')).toBe('/')
        expect(pathFor('songs', ID)).toBe(`/songs/${ID}`)
        expect(pathFor('quiz', ID)).toBe('/quiz')
        FEATURES.forEach(f => {
            const paths = [pathFor(f.id), ...(f.isParam ? [pathFor(f.id, ID)] : [])]
            paths.forEach(p => {
                const { id, param } = routeFromPath(p)
                expect(pathFor(id, param)).toBe(p)
            })
        })
    })

    test('ids and paths are unique, and home has no card', () => {
        expect(new Set(FEATURES.map(f => f.id)).size).toBe(FEATURES.length)
        expect(new Set(FEATURES.map(f => f.path)).size).toBe(FEATURES.length)
        expect(CARDS.map(f => f.id)).toEqual(['scales', 'quiz', 'songs'])
    })
})
