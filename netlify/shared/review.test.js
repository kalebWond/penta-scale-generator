// @vitest-environment node
import { checkToken, handleCorrections, reviewToken } from './review.js'

const SECRET = 'test-secret'
const SONG = 'RuHbBro5u2g'

function memoryStore() {
    const data = new Map()
    return {
        data,
        get: async (k) => data.get(k) ?? null,
        set: async (k, v) => { data.set(k, v) },
        list: async (p) => [...data.keys()].filter(k => k.startsWith(p)),
    }
}

const post = (body, song = SONG) => new Request(`https://x/.netlify/functions/corrections?song=${song}`, {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
})
const get = (query) => new Request(`https://x/.netlify/functions/corrections?${query}`)

describe('share links', () => {
    test('a link works for its own song only, and names the musician', () => {
        const token = reviewToken(SECRET, SONG, 'Abebe Kebede')
        expect(checkToken(SECRET, SONG, token)).toBe('Abebe Kebede')
        expect(checkToken(SECRET, 'CocA4mTVKw4', token)).toBeNull()
        expect(checkToken('other-secret', SONG, token)).toBeNull()
        expect(checkToken(SECRET, SONG, token.replace('Abebe', 'Mallory'))).toBeNull()
        expect(checkToken(SECRET, SONG, 'nonsense')).toBeNull()
    })

    test('Amharic names work', () => {
        expect(checkToken(SECRET, SONG, reviewToken(SECRET, SONG, 'አበበ'))).toBe('አበበ')
    })
})

describe('the corrections endpoint', () => {
    test('a good submission is published at once and kept in the history', async () => {
        const store = memoryStore()
        const review = reviewToken(SECRET, SONG, 'Abebe')
        const res = await handleCorrections(post({ review, edits: [{ t: 81.7, c: 'G' }], details: { tonic: 'D' } }), { store, secret: SECRET })
        expect(res.status).toBe(200)
        const saved = await (await handleCorrections(get(`song=${SONG}`), { store, secret: SECRET })).json()
        expect(saved).toMatchObject({ by: 'Abebe', edits: [{ t: 81.7, c: 'G' }], details: { tonic: 'D' } })
        expect([...store.data.keys()].filter(k => k.startsWith('history/'))).toHaveLength(1)
        const all = await (await handleCorrections(get('all=1'), { store, secret: SECRET })).json()
        expect(Object.keys(all)).toEqual([SONG])
    })

    test('a bad link or a bad submission is refused, and nothing is stored', async () => {
        const store = memoryStore()
        const wrongSong = reviewToken(SECRET, 'CocA4mTVKw4', 'Abebe')
        expect((await handleCorrections(post({ review: wrongSong, edits: [] }), { store, secret: SECRET })).status).toBe(403)
        const review = reviewToken(SECRET, SONG, 'Abebe')
        expect((await handleCorrections(post({ review, edits: [{ t: 1, c: 'X9' }] }), { store, secret: SECRET })).status).toBe(400)
        expect(store.data.size).toBe(0)
    })

    test('a song with no corrections gives null', async () => {
        const res = await handleCorrections(get(`song=${SONG}`), { store: memoryStore(), secret: SECRET })
        expect(await res.json()).toBeNull()
    })
})
