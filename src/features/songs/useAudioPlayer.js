import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 100

// A song's own audio file, played with the same controls as a YouTube video: it returns what
// useYouTubePlayer returns ({ ready, playing, duration, error, muted, volume (0-100), time,
// seekTo, play, pause, setMuted, setVolume }), so the page doesn't care which one it has.
// Nothing happens without a `src`. The time is polled like YouTube's, about ten times a second
// (the element's own timeupdate comes only about four times a second).
export function useAudioPlayer(src) {
    const audioRef = useRef(null)
    const [status, setStatus] = useState({
        ready: false, playing: false, duration: 0, error: null, muted: false, volume: 100, rate: 1,
    })
    const [time, setTime] = useState(0)

    useEffect(() => {
        if (!src) return undefined
        const audio = new Audio()
        audio.preload = 'auto'
        audioRef.current = audio
        setStatus(s => ({ ...s, ready: false, playing: false, duration: 0, error: null }))
        setTime(0)

        const update = (fields) => setStatus(s => ({ ...s, ...fields }))
        const onMeta = () => update({ ready: true, duration: audio.duration || 0 })
        const onPlay = () => update({ playing: true })
        const onPause = () => update({ playing: false })
        const onError = () => update({ error: 'The audio file could not be played.' })
        audio.addEventListener('loadedmetadata', onMeta)
        audio.addEventListener('play', onPlay)
        audio.addEventListener('pause', onPause)
        audio.addEventListener('ended', onPause)
        audio.addEventListener('error', onError)
        audio.src = src

        const poll = setInterval(() => {
            const t = audio.currentTime
            setTime(prev => (Math.abs(prev - t) < 0.01 ? prev : t))
        }, POLL_MS)

        return () => {
            clearInterval(poll)
            audio.pause()
            audio.removeEventListener('loadedmetadata', onMeta)
            audio.removeEventListener('play', onPlay)
            audio.removeEventListener('pause', onPause)
            audio.removeEventListener('ended', onPause)
            audio.removeEventListener('error', onError)
            audio.removeAttribute('src')
            audio.load()
            audioRef.current = null
        }
    }, [src])

    const seekTo = useCallback((t) => {
        const audio = audioRef.current
        if (!audio) return
        audio.currentTime = t
        setTime(t)
    }, [])

    const play = useCallback(() => {
        audioRef.current?.play()?.catch(() => {})   // a play the browser refuses just stays paused
    }, [])
    const pause = useCallback(() => { audioRef.current?.pause() }, [])

    const setMuted = useCallback((muted) => {
        if (!audioRef.current) return
        audioRef.current.muted = muted
        setStatus(s => ({ ...s, muted }))
    }, [])

    const setVolume = useCallback((volume) => {
        const audio = audioRef.current
        if (!audio) return
        audio.volume = volume / 100
        if (volume > 0) audio.muted = false
        setStatus(s => ({ ...s, volume, muted: volume === 0 ? s.muted : false }))
    }, [])

    const setRate = useCallback((rate) => {
        if (!audioRef.current) return
        audioRef.current.playbackRate = rate
        setStatus(s => ({ ...s, rate }))
    }, [])

    return { ...status, time, seekTo, play, pause, setMuted, setVolume, setRate }
}
