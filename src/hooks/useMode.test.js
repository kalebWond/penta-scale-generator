import { pathFor, routeFromPath } from './useMode'

describe('routes', () => {
    test('practice, quiz and chords', () => {
        expect(routeFromPath('/')).toEqual({ mode: 'practice', songId: null })
        expect(routeFromPath('/quiz')).toEqual({ mode: 'quiz', songId: null })
        expect(routeFromPath('/quiz/')).toEqual({ mode: 'quiz', songId: null })
        expect(routeFromPath('/chords')).toEqual({ mode: 'chords', songId: null })
        expect(routeFromPath('/chords/CocA4mTVKw4')).toEqual({ mode: 'chords', songId: 'CocA4mTVKw4' })
        expect(routeFromPath('/chords/CocA4mTVKw4/')).toEqual({ mode: 'chords', songId: 'CocA4mTVKw4' })
    })

    test('anything else is practice; a bad song id is the song list', () => {
        expect(routeFromPath('/nope')).toEqual({ mode: 'practice', songId: null })
        expect(routeFromPath('/quiz/extra')).toEqual({ mode: 'practice', songId: null })
        expect(routeFromPath('/chords/not-an-id')).toEqual({ mode: 'chords', songId: null })
        expect(routeFromPath('/chords/a/b')).toEqual({ mode: 'practice', songId: null })
    })

    test('paths round-trip', () => {
        expect(pathFor('practice')).toBe('/')
        expect(pathFor('chords')).toBe('/chords')
        expect(pathFor('chords', 'CocA4mTVKw4')).toBe('/chords/CocA4mTVKw4')
        expect(pathFor('quiz', 'CocA4mTVKw4')).toBe('/quiz')
        ;['/', '/quiz', '/chords', '/chords/CocA4mTVKw4'].forEach(p => {
            const { mode, songId } = routeFromPath(p)
            expect(pathFor(mode, songId)).toBe(p)
        })
    })
})
