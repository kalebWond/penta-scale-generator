import { useCallback, useEffect, useRef, useState } from 'react'

// The YouTube IFrame Player API, loaded once on first use.
let apiPromise = null

function loadApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT)
    if (!apiPromise) {
        apiPromise = new Promise((resolve, reject) => {
            const previous = window.onYouTubeIframeAPIReady
            window.onYouTubeIframeAPIReady = () => {
                previous?.()
                resolve(window.YT)
            }
            const script = document.createElement('script')
            script.src = 'https://www.youtube.com/iframe_api'
            script.async = true
            script.onerror = () => {
                apiPromise = null
                script.remove()
                reject(new Error('The YouTube player could not be loaded. Check your connection.'))
            }
            document.head.appendChild(script)
        })
    }
    return apiPromise
}

const ERRORS = {
    2: 'This video id is not valid.',
    5: 'The video could not be played in this browser.',
    100: 'This video was removed or is private.',
    101: 'The owner does not allow this video to be played here.',
    150: 'The owner does not allow this video to be played here.',
}

const POLL_MS = 100

// Mounts a YouTube player inside `containerRef` and reports its time about ten times a second.
// The time is polled rather than taken from events because YouTube sends none while playing.
// YouTube's own controls are hidden: the page draws its own (play, pause, seek, restart, sound).
// The player still has to be at least 200px by 200px (YouTube's rule for embeds).
export function useYouTubePlayer(containerRef, videoId) {
    const playerRef = useRef(null)
    const [status, setStatus] = useState({
        ready: false, playing: false, duration: 0, error: null, muted: false, volume: 100,
    })
    const [time, setTime] = useState(0)
    // Right after a seek, YouTube can still report the old position once or twice; those
    // reports would flash the old spot on the track, so they're dropped until the new one shows.
    const pendingSeek = useRef(null)

    useEffect(() => {
        const container = containerRef.current
        if (!videoId || !container) return undefined
        let cancelled = false
        let poll = null
        const mount = document.createElement('div')   // YouTube replaces this with its iframe
        container.appendChild(mount)
        setStatus(s => ({ ...s, ready: false, playing: false, duration: 0, error: null }))
        setTime(0)

        loadApi().then(YT => {
            if (cancelled) return
            playerRef.current = new YT.Player(mount, {
                videoId,
                width: '100%',
                height: '100%',
                playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3 },
                events: {
                    onReady: (e) => {
                        if (cancelled) return
                        const p = e.target
                        setStatus(s => ({
                            ...s, ready: true, duration: p.getDuration() || 0, muted: p.isMuted(), volume: p.getVolume(),
                        }))
                        poll = setInterval(() => {
                            const t = playerRef.current?.getCurrentTime?.()
                            if (typeof t !== 'number') return
                            const seek = pendingSeek.current
                            if (seek) {
                                if (Math.abs(t - seek.t) > 1 && performance.now() < seek.until) return
                                pendingSeek.current = null
                            }
                            setTime(prev => (Math.abs(prev - t) < 0.01 ? prev : t))
                        }, POLL_MS)
                    },
                    onStateChange: (e) => {
                        if (cancelled) return
                        setStatus(s => ({
                            ...s,
                            playing: e.data === YT.PlayerState.PLAYING,
                            duration: e.target.getDuration() || s.duration,
                        }))
                    },
                    onError: (e) => {
                        if (!cancelled) setStatus(s => ({ ...s, error: ERRORS[e.data] ?? 'The video could not be played.' }))
                    },
                },
            })
        }, error => {
            if (!cancelled) setStatus(s => ({ ...s, error: error.message }))
        })

        return () => {
            cancelled = true
            clearInterval(poll)
            playerRef.current?.destroy?.()
            playerRef.current = null
            mount.remove()
            container.replaceChildren()
        }
    }, [containerRef, videoId])

    const seekTo = useCallback((t) => {
        const player = playerRef.current
        if (!player?.seekTo) return
        pendingSeek.current = { t, until: performance.now() + 1500 }
        player.seekTo(t, true)
        setTime(t)
    }, [])

    const play = useCallback(() => { playerRef.current?.playVideo?.() }, [])
    const pause = useCallback(() => { playerRef.current?.pauseVideo?.() }, [])

    const setMuted = useCallback((muted) => {
        const player = playerRef.current
        if (!player?.mute) return
        if (muted) player.mute()
        else player.unMute()
        setStatus(s => ({ ...s, muted }))
    }, [])

    const setVolume = useCallback((volume) => {
        const player = playerRef.current
        if (!player?.setVolume) return
        player.setVolume(volume)
        if (volume > 0 && player.isMuted()) player.unMute()
        setStatus(s => ({ ...s, volume, muted: volume === 0 ? s.muted : false }))
    }, [])

    return { ...status, time, seekTo, play, pause, setMuted, setVolume }
}
