import { displayChords } from './timeline'
import { barStarts, buildTrack, trackLayout } from './track'

// 120 BPM, 3 beats a bar, the first beat at 1.0 s (a 1 s intro with no beat), downbeats every 1.5 s.
const BEATS = Array.from({ length: 9 }, (_, i) => 1 + i * 0.5)            // 1.0 .. 5.0
const SONG = {
    duration: 6.5,
    beatsPerBar: 3,
    beats: BEATS,
    downbeats: [1, 2.5, 4],
    chords: [
        { t: 0, c: 'N' },
        { t: 1, c: 'Em' },
        { t: 2.5, c: 'D', bass: 'F#' },
        { t: 3.5, c: 'C' },
        { t: 4, c: 'Em' },
    ],
}
const cellsFor = (simplify = false) => buildTrack(SONG, displayChords(SONG.chords, simplify))

describe('the chord track', () => {
    test('an intro cell, a cell per beat, an outro cell', () => {
        const cells = cellsFor()
        expect(cells.map(c => c.t)).toEqual([0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5])
        expect(cells[0].end).toBe(1)                     // intro runs to the first beat
        expect(cells[9]).toMatchObject({ t: 5, end: 5.5 })  // the last beat lasts one beat
        expect(cells[10]).toMatchObject({ t: 5.5, end: 6.5 })  // outro to the end of the video
    })

    test('bars start on downbeats; intro and outro are bars of their own', () => {
        const cells = cellsFor()
        expect(cells.map(c => c.bar)).toEqual([0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4])
        expect(cells.filter(c => c.barStart).map(c => c.t)).toEqual([0, 1, 2.5, 4, 5.5])
    })

    test('a chord is written where it starts', () => {
        const cells = cellsFor()
        expect(cells.map(c => c.label)).toEqual(
            [null, 'Em', null, null, 'D/F#', null, 'C', 'Em', null, null, null])
        expect(cells.map(c => c.kind)).toEqual(
            ['silence', 'change', null, null, 'change', null, 'change', 'change', null, null, null])
        expect(cells.map(c => c.name)).toEqual(
            ['', 'Em', 'Em', 'Em', 'D/F#', 'D/F#', 'C', 'Em', 'Em', 'Em', 'Em'])
    })

    test('a chord held for several bars is written once, where the model says it starts', () => {
        const beats = Array.from({ length: 30 }, (_, i) => i * 0.5)
        const chords = [{ t: 0, c: 'Em' }, { t: 6, c: 'D' }]
        const song = { duration: 15, beatsPerBar: 3, beats, downbeats: beats.filter((_, i) => i % 3 === 0), chords }
        const labels = buildTrack(song, displayChords(chords, false)).filter(c => c.barStart).map(c => c.label)
        expect(labels).toEqual(['Em', null, null, null, 'D', null, null, null, null, null])
    })

    test('simplified names follow the toggle', () => {
        expect(cellsFor(true)[4].label).toBe('D')
    })

    test('a chord between beats goes in the cell it falls in', () => {
        const song = { ...SONG, chords: [{ t: 1, c: 'Em' }, { t: 1.7, c: 'G' }] }
        const cells = buildTrack(song, displayChords(song.chords, false))
        expect(cells.find(c => c.t === 1.5).label).toBe('G')
    })

    test('no beats, no track', () => {
        expect(buildTrack({ ...SONG, beats: [] }, displayChords(SONG.chords, false))).toEqual([])
    })
})

describe('bar lines', () => {
    const beats = Array.from({ length: 24 }, (_, i) => i * 0.5)
    const downbeatsAt = (...idx) => idx.map(i => beats[i])
    const startsOf = (downbeats, bpb = 3) =>
        barStarts(beats, downbeats, bpb).flatMap((s, i) => (s ? [i] : []))

    test('clean downbeats are the bars', () => {
        expect(startsOf(downbeatsAt(0, 3, 6, 9, 12, 15, 18, 21))).toEqual([0, 3, 6, 9, 12, 15, 18, 21])
    })

    test('a missed downbeat still gets its bar line', () => {
        // the model skipped the downbeat at 9: that 6-beat bar is two bars
        expect(startsOf(downbeatsAt(0, 3, 6, 12, 15, 18, 21))).toEqual([0, 3, 6, 9, 12, 15, 18, 21])
    })

    test('a stray downbeat is ignored', () => {
        expect(startsOf(downbeatsAt(0, 3, 6, 7, 9, 12, 15, 18, 21))).toEqual([0, 3, 6, 9, 12, 15, 18, 21])
    })

    test('a real shift, confirmed by the next downbeats, moves the bar lines', () => {
        // regular from 0, then from 10 on the downbeats are every 3 beats again
        expect(startsOf(downbeatsAt(0, 3, 6, 10, 13, 16, 19, 22))).toEqual([0, 3, 6, 9, 10, 13, 16, 19, 22])
    })

    test('a confused passage does not move the bar lines', () => {
        // The test song at 19-27 s, beat by beat: the model's downbeats come 4, 2, 1, 3, 2, 2 beats
        // apart, then settle back on the original count. Three of them (at 7, 10, 13) happen to
        // be a bar apart, but 9 sits among them, so that's not a real shift.
        expect(startsOf(downbeatsAt(0, 3, 7, 9, 10, 13, 15, 17, 18, 21))).toEqual([0, 3, 6, 9, 12, 15, 18, 21])
    })

    test('counted in 3 when the model put a downbeat every 6 (a 6/8 song)', () => {
        // downbeats every 6 beats, then by chance every 3 near the end: still bars of 3 from the start
        const starts = startsOf(downbeatsAt(1, 7, 13, 16, 19, 22))
        expect(starts.slice(0, 5)).toEqual([0, 1, 4, 7, 10])
        expect(starts.filter(i => i >= 1).every((v, i, a) => i === 0 || v - a[i - 1] === 3)).toBe(true)
    })

    test('beats before the first downbeat are a pickup bar', () => {
        expect(startsOf(downbeatsAt(2, 5, 8, 11, 14, 17, 20, 23))).toEqual([0, 2, 5, 8, 11, 14, 17, 20, 23])
    })
})

describe('track layout', () => {
    test('one beat per cell, side by side, no gaps between bars', () => {
        const { lefts, width } = trackLayout(cellsFor(), 40)
        expect(lefts).toEqual([0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400])
        expect(width).toBe(440)
    })

    test('the playhead moves at an even speed, across bar lines too', () => {
        const { xAt } = trackLayout(cellsFor(), 40)
        // 2.25 s is half way through the beat before the bar line at 2.5 s, 2.75 s half way after
        expect(xAt(2.75) - xAt(2.25)).toBe(40)
    })

    test('the playhead moves smoothly through a cell', () => {
        const { xAt, lefts } = trackLayout(cellsFor(), 40)
        expect(xAt(1)).toBe(lefts[1])
        expect(xAt(1.25)).toBe(lefts[1] + 20)
        expect(xAt(0.5)).toBe(20)          // half way through the 1 s intro
        expect(xAt(-1)).toBe(0)
        expect(xAt(99)).toBe(lefts[10] + 40)
    })
})
