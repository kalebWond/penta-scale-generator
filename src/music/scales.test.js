import { notes, NOTE_COUNT, noteIndexByCode } from './notes'
import { SCALES, DEGREES, getScaleRun, findEquivalentScales, rotate, degreeOffset } from './scales'

const names = (keys) => keys.map(k => notes[k].name)

describe('notes', () => {
    test('25 keys from C3 to C5 with the right black keys', () => {
        expect(NOTE_COUNT).toBe(25)
        expect(notes[0].name).toBe('C3')
        expect(notes[1].name).toBe('Db3')
        expect(notes[24].name).toBe('C5')
        expect(notes.filter(n => n.isBlack)).toHaveLength(10)
        expect(new Set(notes.map(n => n.code)).size).toBe(25)
        expect(noteIndexByCode.get('KeyQ')).toBe(0)
    })
})

describe('scale runs', () => {
    test('Tizita major from C plays C D E G A C', () => {
        const { keys } = getScaleRun('TIZITA-1', 0, 0)
        expect(names(keys)).toEqual(['C3', 'D3', 'E3', 'G3', 'A3', 'C4'])
    })

    test('Tizita major from the 6th plays A C D E G A and matches Bati minor from the 1st', () => {
        const tizita = getScaleRun('TIZITA-1', 4, 0)
        expect(names(tizita.keys)).toEqual(['A3', 'C4', 'D4', 'E4', 'G4', 'A4'])
        // Bati minor rooted on A gives the same notes
        const bati = getScaleRun('BATI-2', 0, 9)
        expect(bati.keys).toEqual(tizita.keys)
        expect(bati.steps).toEqual(tizita.steps)
    })

    test('the start offset follows the scale, not a fixed table (Tizita minor 6th is Ab, not A)', () => {
        const { keys } = getScaleRun('TIZITA-2', 4, 0)
        expect(names(keys)[0]).toBe('Ab3')
    })

    // Ethiopian naming: positions carry their diatonic degree from the major pentatonic frame
    // (Tizita major C D E G A -> C 1st, D 2nd, G 5th, A 6th), so the label is NOT index + 1.
    // This guards against "correcting" 5th/6th into 4th/5th.
    test('start positions keep their diatonic-degree names', () => {
        expect(DEGREES.map(d => [d.value, d.label]))
            .toEqual([[0, '1st'], [1, '2nd'], [3, '5th'], [4, '6th']])
    })

    // The point of the feature: starting elsewhere reorders the scale's own notes rather than
    // transposing it. The old fixed-offset table broke this for 5 of the 7 scales.
    test('starting from any degree plays the same notes, never one outside the scale', () => {
        const pcs = (keys) => new Set(keys.map(k => k % 12))
        for (const scale of SCALES) {
            for (let root = 0; root < 12; root++) {
                const expected = pcs(getScaleRun(scale.id, 0, root).keys)
                for (const degree of DEGREES) {
                    expect(pcs(getScaleRun(scale.id, degree.value, root).keys)).toEqual(expected)
                }
            }
        }
    })

    test('every scale x degree x root fits on the keyboard', () => {
        for (const scale of SCALES) {
            for (const degree of DEGREES) {
                for (let root = 0; root < 12; root++) {
                    const { keys } = getScaleRun(scale.id, degree.value, root)
                    expect(keys).toHaveLength(6)
                    expect(Math.min(...keys)).toBeGreaterThanOrEqual(0)
                    expect(Math.max(...keys)).toBeLessThanOrEqual(24)
                    expect(keys[5] - keys[0]).toBe(12)
                }
            }
        }
    })

    test('unknown scale returns null', () => {
        expect(getScaleRun('NOPE', 0, 0)).toBeNull()
    })

    test('degreeOffset / rotate', () => {
        expect(degreeOffset([2, 2, 3, 2, 3], 3)).toBe(7)
        expect(rotate([1, 2, 3], 1)).toEqual([2, 3, 1])
    })
})

describe('findEquivalentScales', () => {
    const groups = findEquivalentScales()
    const labels = (g) => g.entries.map(e => `${e.scaleLabel} ${e.degreeLabel}`)

    test('finds the user example: Tizita major 6th == Bati minor 1st', () => {
        const g = groups.find(x => labels(x).includes('Tizita major 6th'))
        expect(g).toBeDefined()
        expect(labels(g)).toContain('Bati minor 1st')
    })

    test('every group has 2+ entries with identical patterns', () => {
        expect(groups.length).toBeGreaterThan(0)
        for (const g of groups) {
            expect(g.entries.length).toBeGreaterThan(1)
            for (const e of g.entries) {
                const scale = SCALES.find(s => s.id === e.scaleId)
                expect(rotate(scale.steps, e.degree)).toEqual(g.steps)
            }
        }
    })
})
