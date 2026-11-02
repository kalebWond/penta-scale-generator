// ▶ and ■ live outside every text face this app ships, so written as characters they
// fall through to whatever symbol font the OS happens to offer -- DejaVu on Linux, a
// different one on iOS -- at a weight and size that never quite match the label beside
// them. Drawn instead: identical everywhere, and they take the button's own colour.

export function PlayIcon() {
    return (
        <svg className="icon" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
            <path d="M1 1l10 6-10 6z" />
        </svg>
    )
}

// A piano pedal seen from above: the rod it hangs from, and the foot plate flaring out below.
export function SustainIcon() {
    return (
        <svg className="icon" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
            <rect x="5" y="0.5" width="2" height="5.5" rx="0.6" />
            <path d="M3.6 6.5h4.8l2.1 5.4a1.1 1.1 0 0 1-1 1.6H2.5a1.1 1.1 0 0 1-1-1.6z" />
        </svg>
    )
}

export function StopIcon() {
    return (
        <svg className="icon" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
            <rect x="1.5" y="2" width="9" height="10" rx="1.2" />
        </svg>
    )
}
