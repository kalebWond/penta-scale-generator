import { DEGREES, degreeOffset, getScale } from '../../music/scales'

// A song is the JSON that tools/analyze.py writes to public/songs/<videoId>.json:
//   { videoId, title, duration, key, tonic, mode, bpm, beatsPerBar,
//     chords: [{ t, c, bass? }], beats: [t], downbeats: [t], manual? }
// `c` is already the simplified chord name ("D", "Em", "Bbm", "Bdim"); `bass` is set only
// for a slash chord (D/F#). "N" means no chord.
//
// `manual` holds what a person set by hand because the models can't tell, and it wins over
// what they found. The analysis tool keeps it when a song is analyzed again. For example:
//   "manual": { "beatsPerBar": 3, "scaleId": "TIZITA-1", "degree": 1, "tonic": "D" }
//   - beatsPerBar: the beat model only finds beats and downbeats, so it can't tell 3/4 from
//     6/8 and may put a downbeat every 3 or every 6 eighth notes.
//   - scaleId + degree: which Ethiopian scale, from which start (degree as in music/scales.js:
//     0 = 1st, 1 = 2nd, 3 = 5th, 4 = 6th). The chord model only knows major and minor keys.
//   - tonic: the song's home note, where that scale starts.

// The song with its manual settings applied.
export const withManual = (song) => (song?.manual ? { ...song, ...song.manual } : song)

export const NO_CHORD = 'N'

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// "F#" -> 6, "Bb" -> 10, "Cb" -> 11; null if it isn't a note name.
export function notePc(name) {
    const m = /^([A-G])([#b]*)$/.exec(name ?? '')
    if (!m) return null
    const shift = [...m[2]].reduce((n, c) => n + (c === '#' ? 1 : -1), 0)
    return (((LETTER_PC[m[1]] + shift) % 12) + 12) % 12
}

// "Bbm" -> { root: 'Bb', quality: 'min' }; null for "N" or anything unreadable.
export function parseChordName(name) {
    const m = /^([A-G][#b]*)(m|dim)?$/.exec(name ?? '')
    if (!m) return null
    return { root: m[1], quality: m[2] === 'm' ? 'min' : m[2] === 'dim' ? 'dim' : 'maj' }
}

// Sharps and flats as their proper glyphs: "Bbm/F#" -> "B♭m/F♯".
export const pretty = (name) => name.replace(/([A-G])(#{1,2}|b{1,2})/g,
    (_, letter, acc) => letter + acc.replace(/#/g, '♯').replace(/b/g, '♭'))

// Index of the last item at or before time t (-1 if t is before the first).
export function indexAt(list, t, timeOf = (x) => x) {
    let lo = 0
    let hi = list.length - 1
    let found = -1
    while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (timeOf(list[mid]) <= t) {
            found = mid
            lo = mid + 1
        } else {
            hi = mid - 1
        }
    }
    return found
}

// What the chord lane shows: one entry per change, named with or without the bass.
// Simplified, D followed by D/F# is one D, so those runs are merged.
export function displayChords(chords, simplify) {
    const out = []
    chords.forEach(chord => {
        const isNone = chord.c === NO_CHORD
        const bass = !simplify && !isNone && chord.bass ? chord.bass : null
        const name = isNone ? '' : bass ? `${chord.c}/${bass}` : chord.c
        if (out.length && out[out.length - 1].name === name) return
        out.push({ t: chord.t, name, c: chord.c, bass })
    })
    return out
}

const TOP_KEY = 24   // the keyboard is C3 (0) .. C5 (24)

// Keyboard keys for a chord: a close root-position triad, as high as fits on the 25 keys,
// with a slash chord's bass note below it when there is room.
export function chordKeys(chord) {
    const parsed = parseChordName(chord?.c)
    if (!parsed) return []
    const rootPc = notePc(parsed.root)
    const third = parsed.quality === 'maj' ? 4 : 3
    const fifth = parsed.quality === 'dim' ? 6 : 7
    const base = rootPc + 12 + fifth <= TOP_KEY ? rootPc + 12 : rootPc
    const keys = [base, base + third, base + fifth]
    const bassPc = notePc(chord.bass)
    if (bassPc !== null) {
        let bass = bassPc
        while (bass + 12 < base) bass += 12     // the closest one under the chord
        if (bass < base) keys.unshift(bass)
    }
    return keys
}

// The Ethiopian scale to light on the keyboard. The chord model can only say major or minor,
// so a minor song gets Bati minor (the minor pentatonic) and a major one Tizita major (the
// major pentatonic), from the 1st, on the song's tonic. `manual` can name the scale and the
// start: Tizita major from the 2nd on D is the notes of C Tizita major (C D E G A), played
// from D, so its home is D.
//   { scaleId, degree, rootPc (the scale's 1st), homePc (where it starts), label }
export function songScale(song) {
    const s = withManual(song)
    const homePc = notePc(s?.tonic)
    if (homePc === null) return null
    const scaleId = s.scaleId ?? (s.mode === 'minor' ? 'BATI-2' : 'TIZITA-1')
    const scale = getScale(scaleId)
    if (!scale) return null
    const degree = s.degree ?? 0
    const rootPc = (((homePc - degreeOffset(scale.steps, degree)) % 12) + 12) % 12
    const from = degree ? ` ${DEGREES.find(d => d.value === degree)?.label ?? ''}` : ''
    return { scaleId, degree, rootPc, homePc, label: `${pretty(s.tonic)} ${scale.label}${from}` }
}

// Which beat of the bar t falls on: { beat: 0-based, count }, or null before the first bar.
export function beatInBar(song, t) {
    const { beats = [], downbeats = [], beatsPerBar = 4 } = song
    const d = indexAt(downbeats, t)
    const b = indexAt(beats, t)
    if (d < 0 || b < 0) return null
    const barStart = indexAt(beats, downbeats[d] + 0.005)   // the beat the bar starts on
    if (barStart < 0) return null
    return { beat: (b - barStart) % beatsPerBar, count: beatsPerBar }
}

// The chords only line up with the exact video they were made from.
export const durationMismatch = (song, actual) =>
    actual > 0 && song?.duration > 0 && Math.abs(actual - song.duration) > 2

export const formatTime = (seconds) => {
    const s = Math.max(0, Math.round(seconds))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
