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

export function PauseIcon() {
    return (
        <svg className="icon" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
            <rect x="1.5" y="1.5" width="3.2" height="11" rx="0.8" />
            <rect x="7.3" y="1.5" width="3.2" height="11" rx="0.8" />
        </svg>
    )
}

// Back to the start: a bar, and a triangle pointing at it.
export function RestartIcon() {
    return (
        <svg className="icon" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
            <rect x="1" y="2" width="2" height="10" rx="0.6" />
            <path d="M11 2v10L3.8 7z" />
        </svg>
    )
}

// Jump 10 seconds: a circular arrow around "10", turning back (rewind) or on (forward).
export function SkipIcon({ forward = false }) {
    return (
        <svg className="icon icon--skip" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <g transform={forward ? 'translate(16 0) scale(-1 1)' : undefined}>
                <path className="icon__stroke" d="M3.2 6.2A5.3 5.3 0 1 1 3 10" />
                <path d="M1.6 2.4l1.9 4.4 4.3-2z" />
            </g>
            <text x="8.6" y="11.2" textAnchor="middle" className="icon__text">10</text>
        </svg>
    )
}

// A speaker, with sound waves or, muted, a cross.
export function VolumeIcon({ muted = false }) {
    return (
        <svg className="icon icon--speaker" viewBox="0 0 16 14" aria-hidden="true" focusable="false">
            <path d="M1 5h3l4-3.5v11L4 9H1z" />
            {muted
                ? <path className="icon__stroke" d="M10.5 4.5l4 5M14.5 4.5l-4 5" />
                : <path className="icon__stroke" d="M10.5 4.5a3.5 3.5 0 0 1 0 5M12.5 2.5a6.3 6.3 0 0 1 0 9" />}
        </svg>
    )
}

// "Back to home", on the brand plate.
export function BackIcon() {
    return (
        <svg className="icon icon--line" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
            <path d="M8 2.5L3.5 7 8 11.5" />
        </svg>
    )
}

// Line drawings for the home screen's cards, one per feature (registry.js names them).
const FEATURE_PATHS = {
    // a run climbing step by step
    scales: <path d="M3 20h4v-4h4v-4h4V8h4V4" />,
    // a speech bubble asking "?"
    quiz: (
        <>
            <path d="M4 5h16v11h-8l-4 4v-4H4z" />
            <path d="M10 9a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.3" />
            <circle cx="12" cy="14.4" r="0.4" />
        </>
    ),
    // two beamed notes
    songs: (
        <>
            <path d="M9 17V6l10-2v11" />
            <circle cx="6.5" cy="17" r="2.5" />
            <circle cx="16.5" cy="15" r="2.5" />
        </>
    ),
}

export function FeatureIcon({ name }) {
    return (
        <svg className="feature-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {FEATURE_PATHS[name]}
        </svg>
    )
}
