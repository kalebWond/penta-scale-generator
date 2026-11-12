import { useState } from 'react'
import { DEGREES, SCALES } from '../../music/scales'
import { pretty, songScale } from './timeline'

const NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const SPEEDS = [1, 0.75, 0.5]

// The musician's tools, over the song while they correct it: who they are, undo and redo,
// playback speed, the song's details (scale, home note, where bars start) and Publish.
function ReviewBar({ name, review, rate, onRate, song }) {
    const [details, setDetails] = useState(false)
    const { draft, status } = review
    const d = draft.details
    const shift = d.barShift ?? 0
    const edits = draft.edits.length
    const detected = songScale(song)     // the scale as shown now: detected, or as set

    return (
        <section className="review" aria-label="Correcting the chords">
            <div className="review__bar">
                <span className="review__who">Correcting as <b>{name}</b></span>
                <span className="review__count">{edits} {edits === 1 ? 'edit' : 'edits'}</span>
                <button type="button" className="btn btn--ghost btn--small" onClick={review.undo} disabled={!review.canUndo}>Undo</button>
                <button type="button" className="btn btn--ghost btn--small" onClick={review.redo} disabled={!review.canRedo}>Redo</button>
                <div className="seg seg--small" role="group" aria-label="Playback speed">
                    {SPEEDS.map(s => (
                        <button key={s} type="button" aria-pressed={rate === s} className={rate === s ? 'is-on' : ''}
                            onClick={() => onRate(s)}>{s}×</button>
                    ))}
                </div>
                <button type="button" className="btn btn--ghost btn--small" aria-expanded={details} onClick={() => setDetails(v => !v)}>
                    Song details
                </button>
                <button type="button" className="btn btn--small review__publish" onClick={review.submit} disabled={status.sending}>
                    {status.sending ? 'Publishing…' : 'Publish'}
                </button>
            </div>

            {status.error && <p className="review__msg review__msg--error" role="alert">{status.error}</p>}
            {status.sentAt && !status.error && (
                <p className="review__msg" role="status">Published: everyone now sees your chords. You can keep correcting and publish again.</p>
            )}
            {!status.sentAt && !status.error && (
                <p className="review__hint">Tap a beat to change its chord. Your work is saved in this browser until you publish.</p>
            )}

            {details && (
                <div className="review__details">
                    <label>
                        Scale
                        <select value={d.scaleId ?? detected?.scaleId ?? 'TIZITA-1'} onChange={e => review.setDetails({ scaleId: e.target.value })}>
                            {SCALES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </label>
                    <label>
                        Starting from
                        <select value={d.degree ?? detected?.degree ?? 0} onChange={e => review.setDetails({ degree: Number(e.target.value) })}>
                            {DEGREES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                        </select>
                    </label>
                    <label>
                        Home note
                        <select value={d.tonic ?? song.tonic ?? ''} onChange={e => review.setDetails({ tonic: e.target.value })}>
                            {NOTES.map(n => <option key={n} value={n}>{pretty(n)}</option>)}
                        </select>
                    </label>
                    <span className="review__shift">
                        Bars start
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => review.setDetails({ barShift: shift - 1 })}
                            aria-label="One beat earlier">◀</button>
                        <b>{shift === 0 ? 'as detected' : `${Math.abs(shift)} beat${Math.abs(shift) > 1 ? 's' : ''} ${shift > 0 ? 'later' : 'earlier'}`}</b>
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => review.setDetails({ barShift: shift + 1 })}
                            aria-label="One beat later">▶</button>
                    </span>
                    <label className="review__note">
                        Note (optional)
                        <textarea rows={2} maxLength={500} value={draft.note} onChange={e => review.setNote(e.target.value)}
                            placeholder="Anything worth knowing about this song" />
                    </label>
                </div>
            )}
        </section>
    )
}

export default ReviewBar
