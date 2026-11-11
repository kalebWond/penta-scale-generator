// A row of mutually exclusive buttons (speed, start position, practice/quiz).
function Segmented({ options, value, onChange, label, className = '' }) {
    return (
        <div className={`seg ${className}`} role="group" aria-label={label}>
            {options.map(o => (
                <button key={o.value} type="button" aria-pressed={o.value === value}
                    className={o.value === value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
                    {o.label}
                </button>
            ))}
        </div>
    )
}

export default Segmented

const MODES = [
    { value: 'practice', label: 'Practice' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'chords', label: 'Chords' },
]

export function ModeSwitch({ mode, onMode }) {
    return <Segmented label="Mode" className="seg--mode" options={MODES} value={mode} onChange={onMode} />
}
