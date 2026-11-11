// A row of mutually exclusive buttons (speed, start position).
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
