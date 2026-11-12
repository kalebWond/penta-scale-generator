import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FeatureIcon } from '../../components/icons'
import Segmented from '../../components/Segmented'
import ChordPicker from './ChordPicker'
import ChordTrack from './ChordTrack'
import PlayerControls from './PlayerControls'
import ReviewBar from './ReviewBar'
import { buildTrack } from './track'
import { useAudioPlayer } from './useAudioPlayer'
import { audioUrl } from './useSongs'
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
// A song from an audio file (dev only) plays that file instead, with the same controls, and
// shows a card where the video would be.
// Dev only: make a share link for a musician to correct this song, and copy it.
async function shareForReview(songId) {
    const name = window.prompt('Share for correcting: the musician\'s name (shown on the song once they publish)')
    if (!name?.trim()) return
    try {
        const res = await fetch(`/api/review-link?song=${songId}&name=${encodeURIComponent(name.trim())}`)
        const body = await res.json()
        if (!res.ok) throw new Error(body.error)
        const link = body.url ?? new URL(body.path, window.location.origin).href
        try { await navigator.clipboard.writeText(link) } catch { /* shown below anyway */ }
        window.prompt(`${body.warning ? `${body.warning}\n\n` : ''}Link for ${name.trim()} (copied):`, link)
    } catch (e) {
        window.alert(`No link: ${e.message}`)
    }
}

// Corrections mode: `review` is the musician's draft (useDraft), `reviewer` their name.
function SongView({
    song, simplify, onToggleSimplify, onChordChange, onAllSongs, nav, models = [], model, onModel,
    review = null, reviewer = null,
}) {
    const videoRef = useRef(null)
    const fileSrc = audioUrl(song)
    const video = useYouTubePlayer(videoRef, fileSrc ? null : song.videoId)
    const file = useAudioPlayer(fileSrc)
    const yt = fileSrc ? file : video
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

    // Correcting: the picker over the chosen beat, and looping a bar to listen again.
    const [picking, setPicking] = useState(null)        // { index, rect }
    const [loop, setLoop] = useState(null)              // { start, end }
    const selectCell = useCallback((index, rect) => {
        setPicking({ index, rect })
        seekTo(cells[index].t)
    }, [cells, seekTo])
    useEffect(() => {
        if (loop && yt.playing && yt.time >= loop.end - 0.05) seekTo(loop.start)
    }, [loop, yt.playing, yt.time, seekTo])
    const loopBar = (cell) => {
        const bar = cells.filter(c => c.bar === cell.bar)
        const range = { start: bar[0].t, end: bar[bar.length - 1].end }
        if (loop && loop.start === range.start) setLoop(null)
        else {
            setLoop(range)
            seekAndPlay(range.start)
        }
    }
    const pickedCell = picking ? cells[picking.index] : null

    const warnings = [
        yt.error,
        !fileSrc && song.embeddable === false && 'YouTube does not allow this video to be played outside YouTube.',
        durationMismatch(song, yt.duration) && `This ${fileSrc ? 'file' : 'video'} is ${formatTime(yt.duration)} `
            + `long, but the chords were made from a ${formatTime(song.duration)} version, so they may not line up.`,
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
                {models.length > 1 && (
                    <Segmented className="songview__models" label="Chord model" options={models}
                        value={model} onChange={onModel} />
                )}
                {import.meta.env.DEV && !review && (
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => shareForReview(song.videoId)}
                        title="Make a link for a musician to correct this song's chords">Share</button>
                )}
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
                        {song.checkedBy && <span className="lane__checked">✓ Chords checked by {song.checkedBy}</span>}
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

            {fileSrc ? (
                <div className="songview__video songview__video--file" title={song.audio}>
                    <FeatureIcon name="songs" />
                    <span>Audio file</span>
                </div>
            ) : (
                <div className="songview__video" ref={videoRef} />
            )}

            <div className="songview__track">
                {cells.length > 0 && (
                    <ChordTrack cells={cells} time={yt.time} playing={yt.playing} onSeek={seekAndPlay}
                        beatWidth={compact ? 44 : 60} rate={yt.rate ?? 1}
                        onSelect={review ? selectCell : null} selected={picking?.index ?? -1} />
                )}
            </div>

            {review && (
                <div className="songview__review">
                    <ReviewBar name={reviewer} review={review} rate={yt.rate ?? 1} onRate={yt.setRate} song={song} />
                </div>
            )}
            {review && pickedCell && (
                <ChordPicker cell={pickedCell} anchor={picking.rect} song={song}
                    startsHere={pickedCell.kind === 'change'} looping={Boolean(loop)}
                    onPick={(edit) => { review.setEdit(edit); setPicking(null) }}
                    onClose={() => setPicking(null)} onPlayFrom={seekAndPlay}
                    onLoopBar={() => loopBar(pickedCell)} />
            )}
        </div>
    )
}

export default SongView
