import { useMemo } from 'react'
import { notes } from '../music/notes'
import { findEquivalentScales, formatStep } from '../music/scales'

// The same interval pattern shows up under different names depending on where you start,
// e.g. Tizita major from the 6th is Bati minor from the 1st. Tapping an entry loads it
// onto the current start note so you can see and hear that the notes are identical.
function EquivalentScales({ startPc, onSelect, onClose }) {
    const groups = useMemo(findEquivalentScales, [])
    const startName = notes[startPc].display

    return (
        <div className="sheet-backdrop" onClick={onClose}>
            <aside className="sheet" role="dialog" aria-label="Similar scales" onClick={(e) => e.stopPropagation()}>
                <header className="sheet__head">
                    <div>
                        <h2>Same pattern, different name</h2>
                        <p>Tap one to play it starting on <strong>{startName}</strong>. Every row in a card uses the same notes.</p>
                    </div>
                    <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
                </header>
                <div className="sheet__body">
                    {groups.map(group => (
                        <section key={group.steps.join()} className="card">
                            <p className="card__pattern">{group.steps.map(s => `${formatStep(s)}Tone`).join(' · ')}</p>
                            <ul>
                                {group.entries.map(entry => (
                                    <li key={entry.scaleId + entry.degree}>
                                        <button type="button" className="card__row" onClick={() => onSelect(entry)}>
                                            <span className="card__play" aria-hidden="true">▶</span>
                                            <span>{entry.scaleLabel}</span>
                                            <span className="card__deg">{entry.degreeLabel}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </aside>
        </div>
    )
}

export default EquivalentScales
