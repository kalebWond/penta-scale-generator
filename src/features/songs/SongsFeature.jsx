import { useMemo, useState } from 'react'
import Piano, { NO_ROLES, rolesFor } from '../../components/Piano'
import { useStickyState } from '../../hooks/useStickyState'
import { getScaleRun } from '../../music/scales'
import { applyCorrections } from './corrections'
import SongLibrary from './SongLibrary'
import SongView from './SongView'
import { chordKeys, songScale, withManual } from './timeline'
import { usePublishedCorrections, useDraft, useReviewToken } from './useReview'
import { TIMELINE_FIELDS, useChordModels, useSong, useSongIndex, useSongInModel } from './useSongs'

const MAIN_MODEL = { value: 'lv', label: 'lv-chordia' }

// Dev only: the song as another chord model hears it (same beats, same rules), to compare models
// by ear. The choice is remembered across songs; a song without that model shows the main one.
function useModelChoice(songId, song) {
    const [choice, setChoice] = useStickyState('songs.chordModel', MAIN_MODEL.value)
    const models = useChordModels(songId)
    const listed = models.data ?? []
    const active = listed.some(m => m.model === choice) ? choice : null
    const version = useSongInModel(songId, active)
    const options = listed.length ? [MAIN_MODEL, ...listed.map(m => ({ value: m.model, label: m.label }))] : []
    let shown = song
    if (song && active && version.data) {
        const timeline = Object.fromEntries(TIMELINE_FIELDS.map(k => [k, version.data[k]]))
        shown = withManual({ ...song, ...timeline })
    }
    return { song: shown, options, value: active ?? MAIN_MODEL.value, onChange: setChoice }
}

function SongPlayer({ instrument, nav, songId, go }) {
    const song = useSong(songId)
    const model = useModelChoice(songId, song.data)
    const [simplify, setSimplify] = useStickyState('songs.simplify', false)

    // A musician's corrections go over the main model's chords: the published ones, or, while
    // they're correcting (opened from their share link), their draft as it stands.
    const token = useReviewToken(songId)
    const published = usePublishedCorrections(songId, song.data?.corrections)
    const review = useDraft(songId, token, published.corrections, published.loaded, published.reload)
    const onMainModel = model.value === MAIN_MODEL.value
    const reviewing = Boolean(token) && onMainModel && review.ready
    const shown = useMemo(() => {
        if (!model.song || !onMainModel) return model.song
        return applyCorrections(model.song, reviewing ? review.draft : published.corrections)
    }, [model.song, onMainModel, reviewing, review.draft, published.corrections])
    const [currentChord, setCurrentChord] = useState(null)

    const roles = useMemo(() => {
        const scale = songScale(shown)
        // from the song's start degree, so its home note is the one marked as the start
        return scale ? rolesFor(getScaleRun(scale.scaleId, scale.degree, scale.rootPc).keys) : NO_ROLES
    }, [shown])
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
            <SongView key={songId} song={shown} nav={nav} onAllSongs={() => go('songs')}
                models={model.options} model={model.value} onModel={model.onChange}
                review={reviewing ? review : null} reviewer={token?.slice(0, token.lastIndexOf('~'))}
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
