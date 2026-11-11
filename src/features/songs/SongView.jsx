import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FeatureIcon } from '../../components/icons'
import ChordTrack from './ChordTrack'
import PlayerControls from './PlayerControls'
import { buildTrack } from './track'
import { useYouTubePlayer } from './useYouTubePlayer'
import {
    beatInBar, displayChords, durationMismatch, formatTime, indexAt, pretty, songScale,
} from './timeline'

// Phones in landscape get narrower beats, like the rest of the app's short-screen layout.
const COMPACT = '(max-height: 520px)'

function useCompact() {
    const [compact, setCompact] = useState(() => window.matchMedia(COMPACT).matches)
    useEffect(() => {
        const query = window.matchMedia(COMPACT)
        const onChange = () => setCompact(query.matches)
        query.addEventListener('change', onChange)
        return () => query.removeEventListener('change', onChange)
    }, [])
    return compact
}

// The space bar plays and pauses, unless it's typing or pressing a focused button.
function useSpaceToPlay(yt) {
    const latest = useRef(yt)
    latest.current = yt
    useEffect(() => {
        const onKey = (e) => {
            if (e.code !== 'Space' || e.repeat) return
            if (e.target?.closest?.('input, textarea, select, button')) return
            e.preventDefault()
            const { playing, play, pause, ready } = latest.current
            if (!ready) return
            if (playing) pause()
            else play()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])
}

// One song, in the panel above the keys. Left: the header, the chord now (big), the beat, the
// next chord and the video's controls. Right: the video, small. Underneath: the sliding track.
function SongView({ song, simplify, onToggleSimplify, onChordChange, onAllSongs, nav }) {
    const videoRef = useRef(null)
    const yt = useYouTubePlayer(videoRef, song.videoId)
    const compact = useCompact()
    useSpaceToPlay(yt)

    const shown = useMemo(() => displayChords(song.chords, simplify), [song, simplify])
    const cells = useMemo(() => buildTrack(song, shown), [song, shown])
    const index = indexAt(shown, yt.time, c => c.t)
    const current = index >= 0 ? shown[index] : null
    const next = shown.slice(index + 1).find(entry => entry.name)
    const scale = songScale(song)
    const beat = beatInBar(song, yt.time)

    useEffect(() => { onChordChange(current) }, [current, onChordChange])
    useEffect(() => () => onChordChange(null), [onChordChange])
    useEffect(() => { document.title = `${song.title} · Chords · PentaScales` }, [song.title])

    const { seekTo, play } = yt
    const seekAndPlay = useCallback((t) => { seekTo(t); play() }, [seekTo, play])

    const warnings = [
        yt.error,
        song.embeddable === false && 'YouTube does not allow this video to be played outside YouTube.',
        durationMismatch(song, yt.duration) && `This video is ${formatTime(yt.duration)} long, but the chords `
            + `were made from a ${formatTime(song.duration)} version, so they may not line up.`,
    ].filter(Boolean)

    // Before the first chord and after the last there's nothing to play: a note, not a dash.
    const now = current?.name
        ? pretty(current.name)
        : <span className="lane__rest" aria-label="No chord yet"><FeatureIcon name="songs" /></span>

    return (
        <div className="songview">
            <header className="songview__head">
                {nav}
                <button type="button" className="btn btn--ghost btn--small" onClick={onAllSongs}>Songs</button>
                <h2 className="songview__title" title={song.title}>{song.title}</h2>
                <button type="button" className="btn btn--ghost btn--small" aria-pressed={simplify}
                    onClick={onToggleSimplify} title="Show slash chords as their plain chord: D/F♯ as D">
                    Simplify
                </button>
            </header>

            <div className="songview__now">
                <div className="lane__now" aria-label="Chord now">{now}</div>
                <div className="songview__side">
                    <p className="lane__meta">
                        <b>{scale?.label ?? song.key}</b>
                        {song.bpm && <span>{Math.round(song.bpm)} BPM</span>}
                    </p>
                    <div className="lane__beats" aria-hidden="true">
                        {Array.from({ length: beat?.count ?? song.beatsPerBar ?? 4 }, (_, k) => (
                            <i key={k} className={beat && k === beat.beat ? 'is-on' : ''} />
                        ))}
                    </div>
                    <p className="lane__nextname">{next && <>Next <b>{pretty(next.name)}</b></>}</p>
                </div>
                {warnings.map(w => <p key={w} className="lane__warn" role="status">{w}</p>)}
            </div>

            <div className="songview__controls">
                <PlayerControls yt={yt} />
            </div>

            <div className="songview__video" ref={videoRef} />

            <div className="songview__track">
                {cells.length > 0 && (
                    <ChordTrack cells={cells} time={yt.time} playing={yt.playing} onSeek={seekAndPlay}
                        beatWidth={compact ? 44 : 60} />
                )}
            </div>
        </div>
    )
}

export default SongView
