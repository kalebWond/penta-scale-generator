import { useCallback, useEffect, useRef, useState } from 'react'
import { getContext, noteOn, stopAll } from '../audio/engine'
import { notes } from '../music/notes'

// Hand-tuned pauses (ms) *before* note i, going up and coming back down.
// The first up-note starts right away; the first down-note is the held pause at the top.
const UP_GAPS = [400, 400, 350, 800, 450, 600]
const DOWN_GAPS = [800, 500, 500, 550, 500, 450]

const LEAD = 0.06        // s between pressing play and the first note, so scheduling is never late
const FLASH = 0.22       // s a key stays lit after it sounds
const TAIL = 1.2         // s the last note is allowed to ring before we call the run finished

// Note times (seconds from the first note) and which step of the run each one is.
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

    const play = useCallback((keys, speed = 1) => {
        if (!keys || keys.length === 0) return
        clearTimers()
        stopAll()
        const t0 = getContext().currentTime + LEAD
        const events = buildSchedule(keys.length, speed)
        const later = (fn, seconds) => timers.current.push(setTimeout(fn, seconds * 1000))

        events.forEach(({ step, time }) => {
            const key = keys[step]
            noteOn(notes[key].name, t0 + time)
            later(() => onNoteRef.current(key, step, true), LEAD + time)
            later(() => onNoteRef.current(key, step, false), LEAD + time + FLASH)
        })
        later(() => {
            setPlaying(false)
            onNoteRef.current(null, null, false)
        }, LEAD + events[events.length - 1].time + TAIL)
        setPlaying(true)
    }, [])

    useEffect(() => () => { clearTimers(); stopAll() }, [])

    return { playing, play, stop }
}
