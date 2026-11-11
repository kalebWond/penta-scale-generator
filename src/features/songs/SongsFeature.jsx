import { useMemo, useState } from 'react'
import Piano, { NO_ROLES, rolesFor } from '../../components/Piano'
import { useStickyState } from '../../hooks/useStickyState'
import { getScaleRun } from '../../music/scales'
import SongsPanel from './SongsPanel'
import { chordKeys, songScale } from './timeline'
import { useSong, useSongIndex } from './useSongs'

// Songs with their chords, played along with the YouTube video. `param` is the song's video id
// (null for the song list). The keys show the song's scale and hold the chord playing now.
function SongsFeature({ instrument, nav, param: songId, go }) {
    const songs = useSongIndex(true)
    const song = useSong(songId)
    const [simplify, setSimplify] = useStickyState('songs.simplify', false)
    const [currentChord, setCurrentChord] = useState(null)

    const songData = songId ? song.data : null
    const roles = useMemo(() => {
        const scale = songScale(songData)
        return scale ? rolesFor(getScaleRun(scale.scaleId, 0, scale.rootPc).keys) : NO_ROLES
    }, [songData])
    const lit = useMemo(() => new Set(chordKeys(currentChord)), [currentChord])

    const panel = (
        <SongsPanel songs={songs} songId={songId} song={song}
            onSelectSong={(id) => go('songs', id)}
            simplify={simplify} onToggleSimplify={() => setSimplify(v => !v)}
            onChordChange={setCurrentChord}
            nav={nav} />
    )

    return <Piano instrument={instrument} panel={panel} roles={roles} lit={lit} wide={Boolean(songId)} />
}

export default SongsFeature
