import { useState } from 'react'
import { enterLandscape } from '../lib/orientation'
import { resume } from '../audio/engine'

// Browsers only let audio (and fullscreen / orientation lock) start from a tap, so one button does all three.
function StartGate({ loaded, total, done, error, onStart }) {
    const [busy, setBusy] = useState(false)

    function start() {
        if (busy) return
        setBusy(true)
        enterLandscape()             // these need the tap's user activation, so start them right away…
        resume().catch(() => {})     // …and don't wait: if resume stalls, the next key press retries it
        onStart()
    }

    return (
        <div className="gate">
            <div className="gate__box">
                <h1 className="brand brand--big">Penta<span>Scales</span></h1>
                <p className="gate__tag">Learn the Ethiopian pentatonic scales and their modes</p>
                <button type="button" className="btn btn--play btn--big" onClick={start} disabled={busy || !!error}>
                    Tap to start
                </button>
                {error
                    ? <p className="gate__status gate__status--error">{error}</p>
                    : <p className="gate__status">
                        {!done ? `Loading sounds ${loaded}/${total}`
                            : loaded < total ? `${total - loaded} sounds failed to load` : 'Sounds ready'}
                        <span className="gate__bar"><i style={{ width: `${(loaded / total) * 100}%` }} /></span>
                    </p>}
                <p className="gate__hint">Best in landscape. Turn your phone sideways.</p>
                <p className="gate__credit">Programmed by Kaleb Wondwossen Tsegaye &copy; 2021</p>
            </div>
        </div>
    )
}

export default StartGate
