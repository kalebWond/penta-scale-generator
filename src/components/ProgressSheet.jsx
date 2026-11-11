import { LEVELS } from '../quiz/levels'
import { topConfusions } from '../quiz/stats'

// How the quiz is going: accuracy per scale and the pairs you mix up most. Saved in this browser.
function ProgressSheet({ stats, items, onReset, onClose }) {
    const { level, best } = stats.progress
    const mixups = topConfusions(stats, items)

    function reset() {
        if (window.confirm('Clear all quiz progress on this device?')) onReset()
    }

    return (
        <div className="sheet-backdrop" onClick={onClose}>
            <aside className="sheet" role="dialog" aria-label="Quiz progress" onClick={(e) => e.stopPropagation()}>
                <header className="sheet__head">
                    <div>
                        <h2>Your progress</h2>
                        <p>Level <strong>{level + 1}</strong> of {LEVELS.length} · best streak <strong>{best}</strong></p>
                    </div>
                    <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
                </header>
                <div className="sheet__body">
                    <section className="card">
                        <p className="card__pattern">Right answers by scale</p>
                        <ul className="stats">
                            {items.map(item => {
                                const s = stats.items[item.id] || { asked: 0, correct: 0 }
                                const pct = s.asked ? Math.round((s.correct / s.asked) * 100) : null
                                return (
                                    <li key={item.id} className="stats__row">
                                        <span>{item.label}</span>
                                        <span className="stats__bar"><i style={{ width: `${pct || 0}%` }} /></span>
                                        <span className="stats__num">{pct === null ? '–' : `${s.correct}/${s.asked}`}</span>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>

                    <section className="card">
                        <p className="card__pattern">Most mixed up</p>
                        {mixups.length === 0 ? (
                            <p className="stats__empty">Nothing yet. Wrong answers show up here.</p>
                        ) : (
                            <ul className="stats">
                                {mixups.map(({ target, answer, count }) => (
                                    <li key={target.id + answer.id} className="stats__row stats__row--mix">
                                        <span><b>{target.label}</b> heard as {answer.label}</span>
                                        <span className="stats__num">×{count}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <button type="button" className="btn btn--ghost stats__reset" onClick={reset}>Reset progress</button>
                </div>
            </aside>
        </div>
    )
}

export default ProgressSheet
