import { useEffect, useMemo, useRef } from 'react'
import { useYouTubePlayer } from './useYouTubePlayer'
import {
    beatInBar, displayChords, durationMismatch, formatTime, indexAt, pretty, songScale,
} from './timeline'

const UPCOMING = 4
const nameOf = (entry) => (entry?.name ? pretty(entry.name) : '—')

// One song: the video beside a lane with the chord now, the beat, and the chords coming up.
function SongView({ song, simplify, onChordChange }) {
    const videoRef = useRef(null)
    const yt = useYouTubePlayer(videoRef, song.videoId)

    const shown = useMemo(() => displayChords(song.chords, simplify), [song, simplify])
    const index = indexAt(shown, yt.time, c => c.t)
    const current = index >= 0 ? shown[index] : null
    const upcoming = useMemo(
        () => shown.slice(index + 1).filter(entry => entry.name).slice(0, UPCOMING), [shown, index])
    const scale = songScale(song)
    const beat = beatInBar(song, yt.time)

    useEffect(() => { onChordChange(current) }, [current, onChordChange])
    useEffect(() => () => onChordChange(null), [onChordChange])
    useEffect(() => { document.title = `${song.title} · Chords · PentaScales` }, [song.title])

    const warnings = [
        yt.error,
        song.embeddable === false && 'YouTube does not allow this video to be played outside YouTube.',
        durationMismatch(song, yt.duration) && `This video is ${formatTime(yt.duration)} long, but the chords `
            + `were made from a ${formatTime(song.duration)} version, so they may not line up.`,
    ].filter(Boolean)

    return (
        <>
            <div className="song__video" ref={videoRef} />
            <div className="lane">
                <p className="lane__meta">
                    <b>{scale?.label ?? song.key}</b>
                    {song.bpm && <span>{Math.round(song.bpm)} BPM</span>}
                    {song.beatsPerBar && <span>{song.beatsPerBar} beats a bar</span>}
                </p>
                <div className="lane__now" aria-label="Chord now">{nameOf(current)}</div>
                <div className="lane__beats" aria-hidden="true">
                    {beat && Array.from({ length: beat.count }, (_, k) => (
                        <i key={k} className={k === beat.beat ? 'is-on' : ''} />
                    ))}
                </div>
                <ol className="lane__next" aria-label="Next chords">
                    {upcoming.map(entry => (
                        <li key={entry.t}>
                            <button type="button" className="chip" disabled={!yt.ready}
                                onClick={() => yt.seekTo(entry.t)} title={`Jump to ${formatTime(entry.t)}`}>
                                {nameOf(entry)}
                            </button>
                        </li>
                    ))}
                </ol>
                {warnings.map(w => <p key={w} className="lane__warn" role="status">{w}</p>)}
            </div>
        </>
    )
}

function SongList({ songs, onSelectSong }) {
    if (songs.loading) return <p className="song__msg">Loading songs…</p>
    if (songs.error) return <p className="song__msg">The song list could not be loaded ({songs.error}).</p>
    if (!songs.data?.length) {
        return <p className="song__msg">No songs yet. Analyze one with <code>tools/analyze.py</code>.</p>
    }
    return (
        <ul className="song__list" aria-label="Songs">
            {songs.data.map(s => (
                <li key={s.videoId}>
                    <button type="button" className="card__row" onClick={() => onSelectSong(s.videoId)}>
                        <span className="song__title">{s.title}</span>
                        <span className="song__key">{s.key ? pretty(s.key) : ''} · {formatTime(s.duration)}</span>
                    </button>
                </li>
            ))}
        </ul>
    )
}

// The panel above the keys for songs: the list, or one song playing.
function SongsPanel({ songs, songId, song, onSelectSong, simplify, onToggleSimplify, onChordChange, nav }) {
    let body
    if (!songId) body = <SongList songs={songs} onSelectSong={onSelectSong} />
    else if (song.loading) body = <p className="song__msg">Loading chords…</p>
    else if (song.error) body = <p className="song__msg">No chords for this song ({song.error}).</p>
    else if (song.data) body = <SongView key={songId} song={song.data} simplify={simplify} onChordChange={onChordChange} />

    return (
        <>
            <header className="toolbar">
                {nav}
                <label className="field field--grow field--song">
                    <span className="field__label">Song</span>
                    <select value={songId ?? ''} onChange={e => onSelectSong(e.target.value || null)}>
                        <option value="">All songs</option>
                        {songs.data?.map(s => <option key={s.videoId} value={s.videoId}>{s.title}</option>)}
                        {songId && !songs.data?.some(s => s.videoId === songId) && (
                            <option value={songId}>{song.data?.title ?? songId}</option>
                        )}
                    </select>
                </label>
                {songId && (
                    <button type="button" className="btn btn--ghost btn--small" aria-pressed={simplify}
                        onClick={onToggleSimplify} title="Show slash chords as their plain chord: D/F♯ as D">
                        Simplify
                    </button>
                )}
            </header>
            <section className={`song${songId ? ' song--playing' : ''}`}>{body}</section>
        </>
    )
}

export default SongsPanel
