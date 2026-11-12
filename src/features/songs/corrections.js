import { DEGREES, SCALES } from '../../music/scales.js'

// A musician's corrections to a song's chords: a layer over what the models found, never an
// overwrite, so analyzing a song again keeps them.
//
//   {
//     by: 'Abebe', at: '2026-11-20T10:00:00.000Z', note: '...',
//     details: { scaleId: 'TIZITA-1', degree: 1, tonic: 'D', barShift: 0 },   // all optional
//     edits: [
//       { t: 81.71, c: 'G' },              // from this beat on, the chord is G
//       { t: 95.32, c: 'C', bass: 'E' },   // C/E
//       { t: 99.10, c: 'N' },              // no chord
//       { t: 97.54, remove: true },        // no change here: the chord before carries on
//     ],
//   }
//
// Edits are pinned to times, not beat numbers: each lands on the nearest beat when it's applied,
// so they stay put if the song is analyzed again or the beat rules change.
//
// This file is shared by the app and the server (netlify/shared/review.js), so it imports with
// explicit extensions and touches nothing browser-only.

export const CHORD_NAME = /^[A-G][#b]?(m|dim)?$/
export const NOTE_NAME = /^[A-G][#b]?$/
const SCALE_IDS = new Set(SCALES.map(s => s.id))
const DEGREE_VALUES = new Set(DEGREES.map(d => d.value))
const EPS = 0.03            // s: a chord this close to a beat is on it
export const MAX_EDITS = 3000

function medianGap(times) {
    const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b)
    return gaps.length ? gaps[gaps.length >> 1] : 0.5
}

// The beat nearest t, if one is within half a beat; else t itself.
export function snapToBeat(beats, t) {
    if (!beats?.length) return t
    let lo = 0
    let hi = beats.length - 1
    while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (beats[mid] < t) lo = mid + 1
        else hi = mid
    }
    const near = [beats[lo - 1], beats[lo]].filter(b => b !== undefined)
        .reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a))
    return Math.abs(near - t) <= medianGap(beats) / 2 ? near : t
}

// The song as the musician corrected it: chords edited, scale and bar start set. `editedTimes`
// lists where edits landed (the track outlines those cells); `checkedBy` is the musician.
export function applyCorrections(song, corrections) {
    if (!song || !corrections) return song
    const beats = song.beats ?? []
    let chords = song.chords.slice()
    const editedTimes = []
    for (const edit of corrections.edits ?? []) {
        const t = snapToBeat(beats, edit.t)
        chords = chords.filter(c => Math.abs(c.t - t) > EPS)
        if (!edit.remove) chords.push(edit.bass ? { t, c: edit.c, bass: edit.bass } : { t, c: edit.c })
        editedTimes.push(t)
    }
    chords.sort((a, b) => a.t - b.t)

    const { scaleId, degree, tonic, barShift } = corrections.details ?? {}
    const out = { ...song, chords, editedTimes, checkedBy: corrections.by ?? null, checkedAt: corrections.at ?? null }
    if (scaleId) out.scaleId = scaleId
    if (degree !== undefined) out.degree = degree
    if (tonic) out.tonic = tonic
    if (barShift) out.downbeats = shiftBars(beats, song.downbeats ?? [], barShift)
    return out
}

// Bars moved by `shift` beats (later if positive): each downbeat moves to the beat that many on.
export function shiftBars(beats, downbeats, shift) {
    const out = []
    for (const d of downbeats) {
        const i = beats.findIndex(b => Math.abs(b - d) < EPS)
        const j = i + shift
        if (i >= 0 && j >= 0 && j < beats.length) out.push(beats[j])
    }
    return out
}

// A submission checked and cleaned for storing. Returns { value } or { error }. The musician's
// name comes from their share link, not from what they send.
export function validateSubmission(body) {
    if (!body || typeof body !== 'object') return { error: 'The submission is empty.' }
    const edits = Array.isArray(body.edits) ? body.edits : []
    if (edits.length > MAX_EDITS) return { error: `At most ${MAX_EDITS} edits.` }
    const clean = []
    for (const e of edits) {
        const t = Number(e?.t)
        if (!Number.isFinite(t) || t < 0 || t > 36000) return { error: 'An edit has a bad time.' }
        const at = Math.round(t * 100) / 100
        if (e.remove === true) {
            clean.push({ t: at, remove: true })
            continue
        }
        if (e.c !== 'N' && !CHORD_NAME.test(e.c ?? '')) return { error: `Not a chord: ${String(e.c).slice(0, 12)}` }
        if (e.bass !== undefined && (e.c === 'N' || !NOTE_NAME.test(e.bass))) {
            return { error: `Not a bass note: ${String(e.bass).slice(0, 12)}` }
        }
        clean.push(e.bass ? { t: at, c: e.c, bass: e.bass } : { t: at, c: e.c })
    }

    const details = {}
    const d = body.details ?? {}
    if (d.scaleId !== undefined) {
        if (!SCALE_IDS.has(d.scaleId)) return { error: 'Unknown scale.' }
        details.scaleId = d.scaleId
    }
    if (d.degree !== undefined) {
        if (!DEGREE_VALUES.has(d.degree)) return { error: 'Unknown start position.' }
        details.degree = d.degree
    }
    if (d.tonic !== undefined) {
        if (!NOTE_NAME.test(d.tonic)) return { error: 'Unknown home note.' }
        details.tonic = d.tonic
    }
    if (d.barShift !== undefined && d.barShift !== 0) {
        if (!Number.isInteger(d.barShift) || Math.abs(d.barShift) > 8) return { error: 'Bad bar shift.' }
        details.barShift = d.barShift
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
    return { value: { edits: clean, details, ...(note ? { note } : {}) } }
}

// One edit in a draft: setting a chord at a beat replaces any edit already there.
export function withEdit(edits, edit) {
    return [...edits.filter(e => Math.abs(e.t - edit.t) > EPS), edit]
}
