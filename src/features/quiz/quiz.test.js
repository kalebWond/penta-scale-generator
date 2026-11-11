import { QUIZ_ITEMS, toQuizItem } from './catalog'
import { LEVELS, PROMOTE_AFTER, DEMOTE_AFTER, advance } from './levels'
import {
    alsoKnownAs, distance, distinctSounds, makeQuestion, pickChoices, pickTarget, sameSound,
} from './questions'
import { emptyStats, loadStats, normalizeStats, recordAnswer, saveStats, topConfusions } from './stats'

// Deterministic randomness, so every run of the suite asks the same questions.
const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const item = (id) => QUIZ_ITEMS.find(i => i.id === id)

describe('catalog', () => {
    test('every current scale from the 1st, plus Tizita major from the 2nd, all sounding different', () => {
        expect(QUIZ_ITEMS.map(i => i.id)).toEqual(
            ['TIZITA-1', 'TIZITA-1@1', 'TIZITA-2', 'AMBASEL-1', 'AMBASEL-2', 'BATI-1', 'BATI-2', 'ANCHOYE'])
        expect(distinctSounds(QUIZ_ITEMS)).toHaveLength(QUIZ_ITEMS.length)
    })

    test('Tizita major 2nd is C D F G B♭ from C, under its own name', () => {
        expect(item('TIZITA-1@1')).toMatchObject({ label: 'Tizita major 2nd', steps: [2, 3, 2, 3, 2] })
    })

    test('a variation gets its own id, label and rotated steps', () => {
        const v = toQuizItem({ scaleId: 'TIZITA-1', degree: 4 })
        expect(v).toMatchObject({ id: 'TIZITA-1@4', label: 'Tizita major from the 6th', steps: [3, 2, 2, 3, 2] })
        expect(() => toQuizItem({ scaleId: 'NOPE' })).toThrow()
    })
})

describe('distance', () => {
    test('counts notes that differ from the same start', () => {
        expect(distance(item('TIZITA-1'), item('AMBASEL-1'))).toBe(1)     // C D E G A vs C D F G A
        expect(distance(item('TIZITA-1'), item('TIZITA-2'))).toBe(2)
        expect(distance(item('TIZITA-2'), item('ANCHOYE'))).toBe(4)
        expect(distance(item('BATI-2'), item('BATI-2'))).toBe(0)
    })
})

describe('choices', () => {
    // Ambasel major has nothing 3 notes away (every other scale is within 2), so "as far apart as the
    // level asks" really means "as far apart as the catalog allows".
    test('match the level: count, target included, every pair as far apart as the catalog allows', () => {
        const rng = seeded(1)
        const farthest = (t) => Math.max(...QUIZ_ITEMS.map(i => distance(i, t)))
        LEVELS.forEach(level => {
            for (let n = 0; n < 50; n++) {
                const target = pickTarget(QUIZ_ITEMS, emptyStats(), rng)
                const choices = pickChoices(target, QUIZ_ITEMS, level, emptyStats(), rng)
                const floor = Math.min(level.minDistance, farthest(target))
                expect(choices).toHaveLength(Math.min(level.choices, QUIZ_ITEMS.length))
                expect(choices).toContain(target)
                choices.forEach(a => choices.forEach(b => {
                    if (a !== b) expect(distance(a, b)).toBeGreaterThanOrEqual(floor)
                }))
            }
        })
    })

    test('the scale you keep confusing with the target is offered', () => {
        let stats = emptyStats()
        stats = recordAnswer(stats, 'TIZITA-1', 'BATI-2', false)
        const choices = pickChoices(item('TIZITA-1'), QUIZ_ITEMS, LEVELS[1], stats, seeded(2))
        expect(choices).toContain(item('BATI-2'))
    })

    test('a catalog with variations: identical-sounding items are never offered together, and both count as right', () => {
        const items = [...QUIZ_ITEMS,
            toQuizItem({ scaleId: 'TIZITA-1', degree: 4 }),      // sounds like Bati minor
            toQuizItem({ scaleId: 'AMBASEL-1', degree: 3 })]
        const rng = seeded(3)
        for (let n = 0; n < 200; n++) {
            const q = makeQuestion({ items, level: LEVELS[LEVELS.length - 1], stats: emptyStats(), rng })
            const sounds = q.choices.map(c => c.steps.join())
            expect(new Set(sounds).size).toBe(sounds.length)
            expect(q.choices.filter(c => sameSound(c, q.target))).toHaveLength(1)
        }
        const twin = items.find(i => i.id === 'TIZITA-1@4')
        expect(sameSound(twin, item('BATI-2'))).toBe(true)
        expect(alsoKnownAs(item('BATI-2'), items)).toEqual([twin])
    })
})

describe('questions', () => {
    test('fixed-root levels start on the home note; others vary', () => {
        const rng = seeded(4)
        const fixed = makeQuestion({ items: QUIZ_ITEMS, level: LEVELS[0], stats: emptyStats(), homeRoot: 7, rng })
        expect(fixed.root).toBe(7)
        expect(fixed.keys).toHaveLength(6)
        expect(fixed.keys[5] - fixed.keys[0]).toBe(12)
        const roots = new Set(Array.from({ length: 40 },
            () => makeQuestion({ items: QUIZ_ITEMS, level: LEVELS[3], stats: emptyStats(), rng }).root))
        expect(roots.size).toBeGreaterThan(4)
    })

    test('the same scale is not asked twice in a row, and weak scales come up more', () => {
        const rng = seeded(5)
        for (let n = 0; n < 30; n++) expect(pickTarget(QUIZ_ITEMS, emptyStats(), rng, 'TIZITA-1').id).not.toBe('TIZITA-1')

        let stats = emptyStats()
        for (let n = 0; n < 10; n++) stats = recordAnswer(stats, 'BATI-1', 'BATI-2', false)
        QUIZ_ITEMS.filter(i => i.id !== 'BATI-1').forEach(i => {
            for (let n = 0; n < 10; n++) stats = recordAnswer(stats, i.id, i.id, true)
        })
        const picks = Array.from({ length: 700 }, () => pickTarget(QUIZ_ITEMS, stats, rng).id)
        const bati = picks.filter(id => id === 'BATI-1').length
        expect(bati).toBeGreaterThan(700 / QUIZ_ITEMS.length * 1.5)
    })
})

describe('levels', () => {
    const start = { level: 0, streak: 0, best: 0, rightRun: 0, wrongRun: 0 }

    test(`${PROMOTE_AFTER} right in a row moves up; ${DEMOTE_AFTER} wrong in a row moves down`, () => {
        let p = start
        for (let n = 0; n < PROMOTE_AFTER; n++) p = advance(p, true)
        expect(p).toMatchObject({ level: 1, streak: PROMOTE_AFTER, best: PROMOTE_AFTER, rightRun: 0 })
        for (let n = 0; n < DEMOTE_AFTER; n++) p = advance(p, false)
        expect(p).toMatchObject({ level: 0, streak: 0, best: PROMOTE_AFTER })
    })

    test('never leaves the ladder', () => {
        let p = start
        for (let n = 0; n < 5; n++) p = advance(p, false)
        expect(p.level).toBe(0)
        for (let n = 0; n < 100; n++) p = advance(p, true)
        expect(p.level).toBe(LEVELS.length - 1)
    })
})

describe('stats', () => {
    test('records attempts and mix-ups, and lists the worst mix-ups first', () => {
        let s = emptyStats()
        s = recordAnswer(s, 'TIZITA-2', 'AMBASEL-2', false)
        s = recordAnswer(s, 'TIZITA-2', 'AMBASEL-2', false)
        s = recordAnswer(s, 'BATI-1', 'BATI-2', false)
        s = recordAnswer(s, 'BATI-1', 'BATI-1', true)
        expect(s.items['TIZITA-2']).toEqual({ asked: 2, correct: 0 })
        expect(s.items['BATI-1']).toEqual({ asked: 2, correct: 1 })
        const top = topConfusions(s, QUIZ_ITEMS)
        expect(top[0]).toMatchObject({ count: 2 })
        expect(top[0].target.id).toBe('TIZITA-2')
    })

    test('stored stats survive a reload; junk, old versions and removed items are tolerated', () => {
        const store = new Map()
        const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
        const s = recordAnswer(emptyStats(), 'BATI-1', 'GONE', false)
        saveStats(s, storage)
        expect(loadStats(storage)).toEqual(s)
        expect(topConfusions(loadStats(storage), QUIZ_ITEMS)).toEqual([])   // 'GONE' isn't in the catalog

        expect(normalizeStats({ version: 99 })).toEqual(emptyStats())
        expect(normalizeStats({ version: 1, progress: { level: 42 } }).progress.level).toBe(LEVELS.length - 1)
        store.set('pentascales.quiz', '{not json')
        expect(loadStats(storage)).toEqual(emptyStats())
        expect(loadStats({ getItem() { throw new Error('blocked') } })).toEqual(emptyStats())
    })
})
