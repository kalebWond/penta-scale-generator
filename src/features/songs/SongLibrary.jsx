import { useMemo } from 'react'
import { useStickyState } from '../../hooks/useStickyState'
import { recommendedSongs, searchSongs, thumbnailUrl } from './library'
import { formatTime, songScale } from './timeline'

function SongCard({ song, onOpen }) {
    const scale = songScale(song)
    return (
        <li>
            <button type="button" className="songcard" onClick={() => onOpen(song.videoId)}>
                <img className="songcard__thumb" src={thumbnailUrl(song.videoId)} alt="" loading="lazy"
                    width="320" height="180" />
                <span className="songcard__title">{song.title}</span>
                <span className="songcard__meta">
                    {scale?.label ?? song.key}{song.duration ? ` · ${formatTime(song.duration)}` : ''}
                </span>
            </button>
        </li>
    )
}

function SongShelf({ title, songs, onOpen, row = false }) {
    return (
        <section className="library__section">
            <h3 className="library__heading">{title}</h3>
            <ul className={row ? 'songrow' : 'songgrid'}>
                {songs.map(s => <SongCard key={s.videoId} song={s} onOpen={onOpen} />)}
            </ul>
        </section>
    )
}

// The songs page: search, recommended picks and every song with chords. No piano here: it
// comes in when a song is opened.
function SongLibrary({ songs, onOpen, nav }) {
    const [query, setQuery] = useStickyState('songs.query', '')
    const all = useMemo(() => songs.data ?? [], [songs.data])
    const results = useMemo(() => searchSongs(all, query), [all, query])
    const picks = useMemo(() => recommendedSongs(all), [all])
    const searching = query.trim().length > 0

    let body
    if (songs.loading) body = <p className="song__msg">Loading songs…</p>
    else if (songs.error) body = <p className="song__msg">The song list could not be loaded ({songs.error}).</p>
    else if (!all.length) body = <p className="song__msg">No songs yet. Analyze one with <code>tools/analyze.py</code>.</p>
    else if (searching) {
        body = results.length
            ? <SongShelf title={`${results.length} ${results.length === 1 ? 'song' : 'songs'}`} songs={results} onOpen={onOpen} />
            : <p className="song__msg">No songs match “{query.trim()}”. Try an artist, a title, or a scale like “bati”.</p>
    } else {
        body = (
            <>
                <SongShelf title="Recommended" songs={picks} onOpen={onOpen} row />
                <SongShelf title="All songs" songs={all} onOpen={onOpen} />
            </>
        )
    }

    return (
        <main className="library">
            <header className="library__head">
                {nav}
                <h2 className="library__title">Songs</h2>
                <input type="search" className="library__search" value={query} placeholder="Search songs, artists or scales"
                    aria-label="Search songs" onChange={e => setQuery(e.target.value)} />
            </header>
            <div className="library__body">{body}</div>
        </main>
    )
}

export default SongLibrary
