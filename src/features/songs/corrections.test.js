import { applyCorrections, shiftBars, snapToBeat, validateSubmission, withEdit } from './corrections'

const beats = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]
const song = {
    beats,
    downbeats: [0, 1.5, 3],
    chords: [{ t: 0, c: 'C' }, { t: 1.5, c: 'G' }, { t: 3, c: 'Am' }],
}

describe('applying corrections', () => {
    test('an edit near a beat lands on it and replaces the chord there', () => {
        const out = applyCorrections(song, { edits: [{ t: 1.58, c: 'G', bass: 'B' }] })
        expect(out.chords).toEqual([{ t: 0, c: 'C' }, { t: 1.5, c: 'G', bass: 'B' }, { t: 3, c: 'Am' }])
        expect(out.editedTimes).toEqual([1.5])
    })

    test('a new change goes in between, and a removed one lets the chord before carry on', () => {
        const out = applyCorrections(song, { edits: [{ t: 2.5, c: 'Em' }, { t: 3, remove: true }] })
        expect(out.chords.map(c => [c.t, c.c])).toEqual([[0, 'C'], [1.5, 'G'], [2.5, 'Em']])
    })

    test('details set the scale and move the bars', () => {
        const out = applyCorrections(song, { by: 'Abebe', edits: [], details: { scaleId: 'TIZITA-1', degree: 1, tonic: 'D', barShift: 1 } })
        expect([out.scaleId, out.degree, out.tonic, out.checkedBy]).toEqual(['TIZITA-1', 1, 'D', 'Abebe'])
        expect(out.downbeats).toEqual([0.5, 2, 3.5])
    })

    test('no corrections, no change', () => {
        expect(applyCorrections(song, null)).toBe(song)
    })

    test('an edit far from any beat keeps its own time', () => {
        expect(snapToBeat(beats, 9)).toBe(9)
        expect(shiftBars(beats, [3.5], 2)).toEqual([])   // past the last beat: dropped
    })

    test('a later edit at the same beat replaces the earlier one in a draft', () => {
        expect(withEdit([{ t: 1.5, c: 'G' }, { t: 3, c: 'Am' }], { t: 1.5, c: 'D' }))
            .toEqual([{ t: 3, c: 'Am' }, { t: 1.5, c: 'D' }])
    })
})

describe('checking a submission', () => {
    test('a good one comes back cleaned', () => {
        const { value } = validateSubmission({
            edits: [{ t: 1.234, c: 'F#m' }, { t: 2, remove: true }, { t: 3, c: 'N' }, { t: 4, c: 'D', bass: 'F#' }],
            details: { scaleId: 'BATI-2', degree: 0, tonic: 'E', barShift: 0 },
            note: '  verse 2 is a capo shape  ',
        })
        expect(value.edits).toEqual([{ t: 1.23, c: 'F#m' }, { t: 2, remove: true }, { t: 3, c: 'N' }, { t: 4, c: 'D', bass: 'F#' }])
        expect(value.details).toEqual({ scaleId: 'BATI-2', degree: 0, tonic: 'E' })
        expect(value.note).toBe('verse 2 is a capo shape')
    })

    test('anything odd is refused', () => {
        expect(validateSubmission({ edits: [{ t: 1, c: 'H7' }] }).error).toMatch(/Not a chord/)
        expect(validateSubmission({ edits: [{ t: -1, c: 'C' }] }).error).toMatch(/bad time/)
        expect(validateSubmission({ edits: [{ t: 1, c: 'N', bass: 'C' }] }).error).toMatch(/bass/)
        expect(validateSubmission({ details: { scaleId: 'NOPE' } }).error).toMatch(/scale/)
        expect(validateSubmission({ details: { barShift: 1.5 } }).error).toMatch(/shift/)
        expect(validateSubmission(null).error).toBeTruthy()
    })
})
