import { ROOTS } from '../music/notes'
import { DEGREES, SCALES } from '../music/scales'

export const SPEEDS = [
    { value: 0.75, label: '0.75×' },
    { value: 1, label: '1×' },
    { value: 1.5, label: '1.5×' },
]

function Segmented({ options, value, onChange, label }) {
    return (
        <div className="seg" role="group" aria-label={label}>
            {options.map(o => (
                <button key={o.value} type="button" aria-pressed={o.value === value}
                    className={o.value === value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
                    {o.label}
                </button>
            ))}
        </div>
    )
}

const blurAfter = (fn) => (e) => {
    fn(e.target.value)
    e.target.blur()      // so the computer-keyboard piano keeps working after a pick
}

function Toolbar({
    rootPc, onRoot, scaleId, onScale, degree, onDegree, speed, onSpeed,
    playing, onPlay, onStop,
}) {
    return (
        <header className="toolbar">
            <h1 className="brand">Penta<span>Scales</span></h1>

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
                {playing ? '■ Stop' : '▶ Play'}
            </button>

            <div className="field">
                <span className="field__label">Speed</span>
                <Segmented label="Speed" options={SPEEDS} value={speed} onChange={onSpeed} />
            </div>

        </header>
    )
}

export default Toolbar
