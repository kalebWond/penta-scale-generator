import { indexAt } from './timeline'

// The sliding chord track: the song as a strip of beat cells, grouped into bars, with each chord
// written in the cell where it starts. Built from the song's beats and downbeats (from the beat
// model) and the chords as the lane shows them (displayChords, so "simplify" applies).

const EPS = 0.03        // s: beats and chords are rounded to 0.01, and chords sit on beats
const EDGE = 0.3        // s: an intro or outro shorter than this gets no cell of its own

function medianGap(times) {
    const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b)
    return gaps.length ? gaps[gaps.length >> 1] : 0.5
}

// Which beats start a bar. The beat model's downbeats are mostly right but not always: it can
// miss one (a 6-beat bar) or add a stray one (a 1- or 2-beat bar), and in a busy passage it can
// lose the bar for a while. So bars are counted at the song's meter, and a downbeat moves the
// count only when the model confirms it cleanly: it and the next two downbeats each land a whole
// bar apart, with no other downbeat between them. (In the test song, 21.62, 23.12 and 24.62 s
// are a bar apart by chance, but 22.62 is a downbeat too: the model is confused there, and
// following it gave a 1-beat and a 2-beat bar.) Beats before the first confirmed downbeat are a
// pickup bar.
export function barStarts(beats, downbeats, beatsPerBar) {
    const isDownbeat = beats.map(t => {
        const i = indexAt(downbeats, t + EPS)
        return i >= 0 && Math.abs(downbeats[i] - t) < EPS
    })
    const confirmed = (i) => {
        const span = 2 * beatsPerBar
        if (i + span >= beats.length) return false
        for (let k = 0; k <= span; k++) {
            if (isDownbeat[i + k] !== (k % beatsPerBar === 0)) return false
        }
        return true
    }
    // Count from the first downbeat, or from a clean run of them that starts within the first
    // couple of bars. (Not from the first clean run anywhere: when the song is counted in 3 but
    // the model put a downbeat every 6, the first clean run was 5 minutes in.)
    const firstDownbeat = Math.max(0, isDownbeat.indexOf(true))
    const firstConfirmed = beats.findIndex((_, i) => confirmed(i))
    const anchor = firstConfirmed >= 0 && firstConfirmed - firstDownbeat < 2 * beatsPerBar
        ? firstConfirmed
        : firstDownbeat

    const starts = beats.map(() => false)
    starts[0] = true
    let count = 0
    beats.forEach((_, i) => {
        if (i < anchor) return
        if (i === anchor || count === beatsPerBar || (confirmed(i) && count > 0)) {
            starts[i] = true
            count = 0
        }
        count += 1
    })
    return starts
}

// Cells: { t, end, bar, barStart, label, kind, name }
//   bar       which bar it belongs to (0-based); an intro or outro without beats is a bar of its own
//   barStart  the first cell of its bar
//   label     the chord name written in the cell, or null
//   kind      'change'  a chord starts here (where the chord model reports a change; a chord it
//                       hears as one stretch is written once, however long it lasts)
//             'silence' no chord, at the very start or end of the song (drawn as an icon)
//             null      nothing written
//   name      the chord sounding as the cell starts ('' for none)
export function buildTrack(song, shown) {
    const beats = song.beats ?? []
    if (!beats.length) return []
    const duration = song.duration ?? beats[beats.length - 1]
    const ibi = medianGap(beats)
    const starts = barStarts(beats, song.downbeats ?? [], song.beatsPerBar || 4)

    const spans = []
    if (beats[0] > EDGE) spans.push({ t: 0, end: beats[0], newBar: true })
    beats.forEach((t, i) => spans.push({
        t,
        end: i + 1 < beats.length ? beats[i + 1] : Math.min(Math.max(duration, t), t + ibi),
        newBar: starts[i],
    }))
    const last = spans[spans.length - 1].end
    if (duration - last > EDGE) spans.push({ t: last, end: duration, newBar: true })

    const atOrBefore = (t) => indexAt(shown, t, c => c.t)
    const firstChord = shown.findIndex(e => e.name)
    const lastChord = shown.findLastIndex(e => e.name)
    let bar = -1
    return spans.map(span => {
        if (span.newBar) bar += 1
        // the chord that starts inside this cell: from just before its start to just before its end
        const first = atOrBefore(span.t - EPS - 1e-6) + 1
        const lastIn = atOrBefore(span.end - EPS - 1e-6)
        const starting = lastIn >= first ? shown[lastIn] : null
        const sounding = shown[atOrBefore(span.t + EPS)]

        let label = null
        let kind = null
        if (starting?.name) {
            label = starting.name
            kind = 'change'
        } else if (starting) {
            // no chord: only worth marking before the first chord or after the last
            if (lastIn < firstChord || lastIn > lastChord) kind = 'silence'
        }
        return { t: span.t, end: span.end, bar, barStart: span.newBar, label, kind, name: sounding?.name ?? '' }
    })
}

// Where each cell sits, in px: every cell is exactly one beat wide, side by side, so the playhead
// moves at an even speed (bars are marked with a border, not a gap it would have to jump).
// xAt(t) is the playhead's position at time t, moving smoothly through each cell.
export function trackLayout(cells, beatWidth) {
    const lefts = cells.map((_, i) => i * beatWidth)
    const width = cells.length ? lefts[lefts.length - 1] + beatWidth : 0
    const xAt = (t) => {
        const i = indexAt(cells, t, c => c.t)
        if (i < 0) return 0
        const c = cells[i]
        const f = Math.min(1, Math.max(0, (t - c.t) / ((c.end - c.t) || 1)))
        return lefts[i] + f * beatWidth
    }
    return { lefts, width, xAt }
}
