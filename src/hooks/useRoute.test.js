import { FEATURES } from '../features/registry'
import { pathFor, routeFromPath } from './useRoute'

const ID = 'CocA4mTVKw4'

describe('routes', () => {
    test('each feature at its path', () => {
        expect(routeFromPath('/')).toEqual({ id: 'scales', param: null })
        expect(routeFromPath('/quiz')).toEqual({ id: 'quiz', param: null })
        expect(routeFromPath('/quiz/')).toEqual({ id: 'quiz', param: null })
        expect(routeFromPath('/chords')).toEqual({ id: 'songs', param: null })
        expect(routeFromPath(`/chords/${ID}`)).toEqual({ id: 'songs', param: ID })
        expect(routeFromPath(`/chords/${ID}/`)).toEqual({ id: 'songs', param: ID })
    })

    test('anything else is the default; a bad song id is the song list', () => {
        expect(routeFromPath('/nope')).toEqual({ id: 'scales', param: null })
        expect(routeFromPath('/quiz/extra')).toEqual({ id: 'scales', param: null })
        expect(routeFromPath('/chords/not-an-id')).toEqual({ id: 'songs', param: null })
        expect(routeFromPath('/chords/a/b')).toEqual({ id: 'scales', param: null })
    })

    test('a song page path is never a song data file', () => {
        // Song data lives at /songs/<id>.json; a page path never ends in .json.
        expect(routeFromPath(`/chords/${ID}.json`)).toEqual({ id: 'songs', param: null })
    })

    test('paths round-trip for every feature', () => {
        expect(pathFor('scales')).toBe('/')
        expect(pathFor('songs', ID)).toBe(`/chords/${ID}`)
        expect(pathFor('quiz', ID)).toBe('/quiz')
        FEATURES.forEach(f => {
            const paths = [pathFor(f.id), ...(f.isParam ? [pathFor(f.id, ID)] : [])]
            paths.forEach(p => {
                const { id, param } = routeFromPath(p)
                expect(pathFor(id, param)).toBe(p)
            })
        })
    })

    test('feature ids and paths are unique', () => {
        expect(new Set(FEATURES.map(f => f.id)).size).toBe(FEATURES.length)
        expect(new Set(FEATURES.map(f => f.path)).size).toBe(FEATURES.length)
    })
})
