import { Fragment } from 'react'
import { notes } from '../music/notes'
import { formatStep, getScale, DEGREES } from '../music/scales'

// The notes of the selected run with the steps between them; lights up as the run plays.
function ScaleReadout({ scaleId, degree, run, step, showLabels, onToggleLabels, onOpenEquivalents }) {
    const scale = getScale(scaleId)
    const degreeLabel = DEGREES.find(d => d.value === degree).label
    const start = notes[run.keys[0]]

    return (
        <section className="readout" aria-live="polite">
            <p className="readout__title">
                {scale.label} <span>from the {degreeLabel} · starts on {start.display}</span>
            </p>
            <div className="readout__tools">
                <button type="button" className="btn btn--ghost" aria-pressed={showLabels}
                    onClick={onToggleLabels} title="Show the computer key on each piano key">
                    Key labels
                </button>
                <button type="button" className="btn btn--ghost" onClick={onOpenEquivalents}
                    title="Scales that are the same pattern under another name">
                    Similar scales
                </button>
            </div>
            <ol className="readout__notes">
                {run.keys.map((k, i) => (
                    <Fragment key={i}>
                        <li className={`chip ${i === 0 ? 'chip--start' : ''} ${step === i ? 'is-now' : ''}`}>
                            {notes[k].display}<sub>{notes[k].octave}</sub>
                        </li>
                        {i < run.steps.length && (
                            <li className="gap" aria-hidden="true">{formatStep(run.steps[i])}<span className="unit">Tone</span></li>
                        )}
                    </Fragment>
                ))}
            </ol>
        </section>
    )
}

export default ScaleReadout
