import {
    beatInBar, chordKeys, displayChords, durationMismatch, formatTime, indexAt, notePc,
    parseChordName, pretty, songScale, withManual,
} from './timeline'

// The opening of the test song (Yihew Liben): E minor, 120 BPM, 3 beats per bar.
const CHORDS = [
    { t: 0, c: 'N' },
    { t: 1.62, c: 'Em' },
    { t: 4.62, c: 'Bm' },
    { t: 7.62, c: 'D' },
    { t: 9.12, c: 'D', bass: 'F#' },
    { t: 10.62, c: 'Em' },
]
const BEATS = Array.from({ length: 30 }, (_, i) => +(0.12 + i * 0.5).toFixed(2))
const SONG = {
    tonic: 'E', mode: 'minor', beatsPerBar: 3, duration: 427, chords: CHORDS,
    beats: BEATS, downbeats: BEATS.filter((_, i) => i >= 3 && i % 3 === 0),
}

describe('note and chord names', () => {
    test('note names to pitch classes', () => {
        expect([notePc('C'), notePc('F#'), notePc('Bb'), notePc('Cb'), notePc('E#')]).toEqual([0, 6, 10, 11, 5])
        expect(notePc('H')).toBeNull()
        expect(notePc(undefined)).toBeNull()
    })

    test('chord names to root and quality', () => {
        expect(parseChordName('Bbm')).toEqual({ root: 'Bb', quality: 'min' })
        expect(parseChordName('D')).toEqual({ root: 'D', quality: 'maj' })
        expect(parseChordName('Bdim')).toEqual({ root: 'B', quality: 'dim' })
        expect(parseChordName('N')).toBeNull()
    })

    test('accidentals become glyphs, other letters are left alone', () => {
        expect(pretty('Bbm/F#')).toBe('B♭m/F♯')
        expect(pretty('Bdim')).toBe('Bdim')
        expect(pretty('Em')).toBe('Em')
    })
})

describe('finding the current chord', () => {
    test('the last chord at or before t', () => {
        const at = (t) => indexAt(CHORDS, t, c => c.t)
        expect(at(0)).toBe(0)
        expect(at(1.61)).toBe(0)
        expect(at(1.62)).toBe(1)
        expect(at(8)).toBe(3)
        expect(at(500)).toBe(5)
        expect(indexAt([], 3)).toBe(-1)
        expect(indexAt([{ t: 2 }], 1, c => c.t)).toBe(-1)
    })
})

describe('what the lane shows', () => {
    test('full names keep the bass', () => {
        expect(displayChords(CHORDS, false).map(c => c.name)).toEqual(['', 'Em', 'Bm', 'D', 'D/F#', 'Em'])
    })

    test('simplified, D then D/F# is one D', () => {
        const shown = displayChords(CHORDS, true)
        expect(shown.map(c => c.name)).toEqual(['', 'Em', 'Bm', 'D', 'Em'])
        expect(shown[3]).toEqual({ t: 7.62, name: 'D', c: 'D', bass: null })
    })
})

describe('chord keys on the keyboard', () => {
    test('a triad as high as fits, with the slash bass under it', () => {
        expect(chordKeys({ c: 'Em' })).toEqual([16, 19, 23])          // E4 G4 B4
        expect(chordKeys({ c: 'D', bass: 'F#' })).toEqual([6, 14, 18, 21])   // F#3 under D4 F#4 A4
        expect(chordKeys({ c: 'Bm' })).toEqual([11, 14, 18])           // too high for B4: B3 D4 F#4
        expect(chordKeys({ c: 'Bdim' })).toEqual([11, 14, 17])
    })

    test('no keys for no chord', () => {
        expect(chordKeys({ c: 'N' })).toEqual([])
        expect(chordKeys(null)).toEqual([])
    })

    test('every key is on the 25-key keyboard', () => {
        const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
        names.forEach(root => ['', 'm', 'dim'].forEach(q => names.forEach(bass => {
            chordKeys({ c: root + q, bass }).forEach(k => {
                expect(k).toBeGreaterThanOrEqual(0)
                expect(k).toBeLessThanOrEqual(24)
            })
        })))
    })
})

describe('the song scale', () => {
    test('a minor song is Bati minor on its tonic', () => {
        expect(songScale(SONG)).toEqual({ scaleId: 'BATI-2', degree: 0, rootPc: 4, homePc: 4, label: 'E Bati minor' })
    })

    test('a major song is Tizita major; a song can name its own scale', () => {
        expect(songScale({ tonic: 'Bb', mode: 'major' }).label).toBe('B♭ Tizita major')
        expect(songScale({ tonic: 'E', mode: 'minor', scaleId: 'TIZITA-2' }).label).toBe('E Tizita minor')
    })

    test('a song can be set to a scale from another start', () => {
        // Aster Abebe's "Simihin Terahu": chords all in C major, home D: Tizita major from the 2nd
        const song = { tonic: 'C', mode: 'major', manual: { scaleId: 'TIZITA-1', degree: 1, tonic: 'D' } }
        expect(songScale(song)).toEqual({ scaleId: 'TIZITA-1', degree: 1, rootPc: 0, homePc: 2, label: 'D Tizita major 2nd' })
    })

    test('manual settings win over what the models found', () => {
        const song = { beatsPerBar: 6, tonic: 'C', manual: { beatsPerBar: 3 } }
        expect(withManual(song)).toMatchObject({ beatsPerBar: 3, tonic: 'C' })
        expect(withManual({ beatsPerBar: 6 })).toEqual({ beatsPerBar: 6 })
    })

    test('no scale without a tonic', () => {
        expect(songScale({ mode: 'minor' })).toBeNull()
        expect(songScale(null)).toBeNull()
    })
})

describe('beat in bar', () => {
    test('counts from the downbeat', () => {
        expect(beatInBar(SONG, 1.62)).toEqual({ beat: 0, count: 3 })
        expect(beatInBar(SONG, 2.2)).toEqual({ beat: 1, count: 3 })
        expect(beatInBar(SONG, 2.7)).toEqual({ beat: 2, count: 3 })
        expect(beatInBar(SONG, 3.12)).toEqual({ beat: 0, count: 3 })
    })

    test('nothing before the first bar', () => {
        expect(beatInBar(SONG, 1.0)).toBeNull()
    })
})

describe('helpers', () => {
    test('a video more than 2 s off is a different cut', () => {
        expect(durationMismatch(SONG, 428)).toBe(false)
        expect(durationMismatch(SONG, 431)).toBe(true)
        expect(durationMismatch(SONG, 0)).toBe(false)
    })

    test('times read as m:ss', () => {
        expect(formatTime(427)).toBe('7:07')
        expect(formatTime(5.4)).toBe('0:05')
    })
})
