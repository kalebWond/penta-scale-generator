import * as files from '../file-index'
import { notes } from '../music/notes'

const MASTER_GAIN = 0.6
const ATTACK = 0.004          // s, removes the click at sample start
const RETRIGGER_TAU = 0.015   // s, previous voice of the same note fades out under the new one
const RELEASE_TAU = 0.18      // s, time constant of the fade after a key is let go
const STOP_TAU = 0.03

let ctx = null
let master = null
const buffers = new Map()   // note name -> AudioBuffer
const latest = new Map()    // note name -> its newest voice { source, gain, startTime }
const active = new Set()    // every voice that is scheduled or still sounding

export function getContext() {
    if (ctx) return ctx
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) throw new Error('Web Audio is not supported in this browser')
    ctx = new AC({ latencyHint: 'interactive' })
    master = ctx.createGain()
    master.gain.value = MASTER_GAIN
    // keeps chords and fast runs from clipping
    const compressor = ctx.createDynamicsCompressor()
    master.connect(compressor)
    compressor.connect(ctx.destination)
    return ctx
}

// Must be called from a user gesture (browsers keep the context suspended until then).
export async function resume() {
    try {
        // iOS: play through the "playback" channel so the hardware mute switch doesn't silence us
        if (navigator.audioSession) navigator.audioSession.type = 'playback'
    } catch (e) { /* not supported */ }
    const c = getContext()
    if (c.state !== 'running') await c.resume()
    return c.state === 'running'
}

export const isLoaded = (name) => buffers.has(name)

// Fetches and decodes every sample in parallel, middle octave first so the most-used keys come up first.
// `onSample(name)` fires as each one is ready; a failed sample is reported and skipped, never blocks the rest.
export function loadSamples(onSample, onError) {
    const c = getContext()
    const order = [...notes.slice(12, 24), ...notes.slice(0, 12), notes[24]]
    return Promise.all(order.map(async ({ name }) => {
        if (buffers.has(name)) return onSample && onSample(name)
        try {
            const res = await fetch(files[name])
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
            const data = await res.arrayBuffer()
            buffers.set(name, await c.decodeAudioData(data))
            onSample && onSample(name)
        } catch (e) {
            onError && onError(name, e)
        }
    }))
}

function release(voice, when, tau) {
    if (when <= voice.startTime) {
        // hasn't started yet: cancel it outright
        try { voice.source.stop(when) } catch (e) { /* already stopped */ }
        return
    }
    const t = Math.max(when, voice.startTime + ATTACK + 0.002)
    voice.gain.gain.setTargetAtTime(0, t, tau)
    try { voice.source.stop(t + tau * 8) } catch (e) { /* already stopped */ }
}

// Starts a note at audio-clock time `when` (default: now). Returns false if the sample isn't ready.
export function noteOn(name, when) {
    const buffer = buffers.get(name)
    if (!buffer) return false
    const c = getContext()
    // Safety net: if the browser suspended/interrupted the context (iOS does), a tap gets it going again.
    if (c.state !== 'running') c.resume().catch(() => {})
    const t = when === undefined ? c.currentTime : Math.max(when, c.currentTime)

    const previous = latest.get(name)
    if (previous) release(previous, t, RETRIGGER_TAU)

    const source = c.createBufferSource()
    source.buffer = buffer
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(1, t + ATTACK)
    source.connect(gain)
    gain.connect(master)
    source.start(t)

    const voice = { source, gain, startTime: t }
    latest.set(name, voice)
    active.add(voice)
    source.onended = () => {
        source.disconnect()
        gain.disconnect()
        active.delete(voice)
        if (latest.get(name) === voice) latest.delete(name)
    }
    return true
}

// A key was let go: let the note die away gently rather than cutting it.
export function noteOff(name, when) {
    if (!ctx) return
    const voice = latest.get(name)
    if (voice) release(voice, when === undefined ? ctx.currentTime : when, RELEASE_TAU)
}

// Silences everything, including notes that are scheduled but haven't started yet.
export function stopAll() {
    if (!ctx) return
    active.forEach(voice => release(voice, ctx.currentTime, STOP_TAU))
}
