import { useCallback, useEffect, useRef, useState } from 'react'
import { getContext, noteOff, noteOn, stopAll } from '../audio/engine'
import { notes } from '../music/notes'

// Hand-tuned pauses (ms) *before* note i, going up and coming back down.
// The first up-note starts right away; the first down-note is the held pause at the top.
const UP_GAPS = [400, 400, 350, 800, 450, 600]
const DOWN_GAPS = [800, 500, 500, 550, 500, 450]

const LEAD = 0.06        // s between pressing play and the first note, so scheduling is never late
const FLASH = 0.22       // s a key stays lit after it sounds
const TAIL = 1.2         // s the last note is allowed to ring before we call the run finished
const LAST_HOLD = 0.8    // s the last note is held before it's damped, when sustain is off
const BETWEEN_RUNS = 1.4 // s from the last note of one run to the first of the next, at 1x

// Note times (seconds from the first note), which step of the run each one is, and `end`:
// when it's damped if sustain is off -- as the next note starts, so the run stays legato.
export function buildSchedule(count, speed = 1) {
    const events = []
    let t = 0
    for (let i = 0; i < count; i++) {
        if (i > 0) t += UP_GAPS[i] / 1000 / speed
        events.push({ step: i, time: t })
    }
    for (let j = 0; j < count; j++) {
        t += DOWN_GAPS[j] / 1000 / speed
        events.push({ step: count - 1 - j, time: t })
    }
    events.forEach((e, i) => {
        e.end = i + 1 < events.length ? events[i + 1].time : e.time + LAST_HOLD / speed
    })
    return events
}

// Plays a run (array of key indices) up and back down on the audio clock, so timing
// doesn't wobble with the JS thread. Visuals are driven by timers set from the same offsets.
// `onNote(keyIndex, step, isOn)` is called for the visual side.
export function useScalePlayer(onNote) {
    const [playing, setPlaying] = useState(false)
    const timers = useRef([])
    const onNoteRef = useRef(onNote)
    onNoteRef.current = onNote

    const clearTimers = () => {
        timers.current.forEach(clearTimeout)
        timers.current = []
    }

    const stop = useCallback(() => {
        clearTimers()
        stopAll()
        setPlaying(false)
        onNoteRef.current(null, null, false)
    }, [])

    // Plays several runs back to back (e.g. your answer, then the right one), each a full up-and-down.
    // With `sustain` every note rings out, like holding the pedal; without it each is damped at its `end`.
    const playRuns = useCallback((runs, speed = 1, sustain = false) => {
        runs = runs.filter(keys => keys && keys.length > 0)
        if (runs.length === 0) return
        clearTimers()
        stopAll()
        const t0 = getContext().currentTime + LEAD
        const later = (fn, seconds) => timers.current.push(setTimeout(fn, seconds * 1000))

        let offset = 0      // s from t0 to the start of the current run
        runs.forEach((keys, r) => {
            const events = buildSchedule(keys.length, speed)
            events.forEach(({ step, time, end }) => {
                const key = keys[step]
                const at = offset + time
                noteOn(notes[key].name, t0 + at)
                if (!sustain) noteOff(notes[key].name, t0 + offset + end)   // targets the voice just scheduled
                later(() => onNoteRef.current(key, step, true), LEAD + at)
                later(() => onNoteRef.current(key, step, false), LEAD + at + FLASH)
            })
            const last = events[events.length - 1]
            offset += last.time + (r < runs.length - 1 ? BETWEEN_RUNS / speed : TAIL)
        })
        later(() => {
            setPlaying(false)
            onNoteRef.current(null, null, false)
        }, LEAD + offset)
        setPlaying(true)
    }, [])

    const play = useCallback((keys, speed, sustain) => playRuns([keys], speed, sustain), [playRuns])

    useEffect(() => () => { clearTimers(); stopAll() }, [])

    return { playing, play, playRuns, stop }
}
