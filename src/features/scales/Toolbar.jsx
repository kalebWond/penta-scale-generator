import { ROOTS } from '../../music/notes'
import { DEGREES, SCALES } from '../../music/scales'
import { PlayIcon, StopIcon } from '../../components/icons'
import Segmented from '../../components/Segmented'
import SpeedField from '../../components/SpeedField'

const blurAfter = (fn) => (e) => {
    fn(e.target.value)
    e.target.blur()      // so the computer-keyboard piano keeps working after a pick
}

function Toolbar({
    rootPc, onRoot, scaleId, onScale, degree, onDegree, speed, onSpeed,
    playing, onPlay, onStop, nav,
}) {
    return (
        <header className="toolbar">
            {nav}

            <label className="field">
                <span className="field__label">Root</span>
                <select value={rootPc} onChange={blurAfter(v => onRoot(Number(v)))}>
                    {ROOTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
            </label>

            <label className="field field--grow">
                <span className="field__label">Scale</span>
                <select value={scaleId} onChange={blurAfter(onScale)}>
                    {SCALES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
            </label>

            <div className="field">
                <span className="field__label">Start on</span>
                <Segmented label="Start on" options={DEGREES} value={degree} onChange={onDegree} />
            </div>

            <button type="button" className={`btn ${playing ? 'btn--stop' : 'btn--play'}`}
                onClick={playing ? onStop : onPlay}>
                {playing ? <><StopIcon /> Stop</> : <><PlayIcon /> Play</>}
            </button>

            <SpeedField speed={speed} onSpeed={onSpeed} />
        </header>
    )
}

export default Toolbar
