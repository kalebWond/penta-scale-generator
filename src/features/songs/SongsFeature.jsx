import { useMemo, useState } from 'react'
import Piano, { NO_ROLES, rolesFor } from '../../components/Piano'
import { useStickyState } from '../../hooks/useStickyState'
import { getScaleRun } from '../../music/scales'
import SongLibrary from './SongLibrary'
import SongView from './SongView'
import { chordKeys, songScale } from './timeline'
import { useSong, useSongIndex } from './useSongs'

function SongPlayer({ instrument, nav, songId, go }) {
    const song = useSong(songId)
    const [simplify, setSimplify] = useStickyState('songs.simplify', false)
    const [currentChord, setCurrentChord] = useState(null)

    const roles = useMemo(() => {
        const scale = songScale(song.data)
        // from the song's start degree, so its home note is the one marked as the start
        return scale ? rolesFor(getScaleRun(scale.scaleId, scale.degree, scale.rootPc).keys) : NO_ROLES
    }, [song.data])
    const lit = useMemo(() => new Set(chordKeys(currentChord)), [currentChord])

    let panel
    if (song.loading) panel = <><header className="songview__head">{nav}</header><p className="song__msg">Loading chords…</p></>
    else if (song.error || !song.data) {
        panel = (
            <>
                <header className="songview__head">
                    {nav}
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => go('songs')}>Songs</button>
                </header>
                <p className="song__msg">No chords for this song ({song.error ?? 'not found'}).</p>
            </>
        )
    } else {
        panel = (
            <SongView key={songId} song={song.data} nav={nav} onAllSongs={() => go('songs')}
                simplify={simplify} onToggleSimplify={() => setSimplify(v => !v)}
                onChordChange={setCurrentChord} />
        )
    }

    // The keys show the song's scale and hold the chord playing now.
    return <Piano instrument={instrument} panel={panel} roles={roles} lit={lit} wide />
}

// Songs with their chords, played along with the YouTube video. `param` is the song's video id:
// without one this is the library (search and picks, no piano); with one, the song and the piano.
function SongsFeature({ instrument, nav, param: songId, go }) {
    const songs = useSongIndex(!songId)
    if (!songId) return <SongLibrary songs={songs} nav={nav} onOpen={(id) => go('songs', id)} />
    return <SongPlayer instrument={instrument} nav={nav} songId={songId} go={go} />
}

export default SongsFeature
