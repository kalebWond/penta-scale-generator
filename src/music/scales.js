// Steps are in semitones (the old code used tones: 0.5 / 1 / 1.5 / 2 — exactly half of these).
export const SCALES = [
    { id: 'TIZITA-1', label: 'Tizita major', steps: [2, 2, 3, 2, 3] },
    { id: 'TIZITA-2', label: 'Tizita minor', steps: [2, 1, 4, 1, 4] },
    { id: 'AMBASEL-1', label: 'Ambasel major', steps: [2, 3, 2, 2, 3] },
    { id: 'AMBASEL-2', label: 'Ambasel minor', steps: [1, 4, 2, 1, 4] },
    { id: 'BATI-1', label: 'Bati major', steps: [4, 1, 2, 4, 1] },
    { id: 'BATI-2', label: 'Bati minor', steps: [3, 2, 2, 3, 2] },
    { id: 'ANCHOYE', label: 'Anchi hoye lene', steps: [1, 4, 1, 3, 3] },
]

// `degree` is the index of the scale note the run starts from (0 = the root). The labels follow
// the Ethiopian naming: a start position is named after its *diatonic* degree, read off the major
// pentatonic frame — Tizita major is C D E G A, so C is the 1st, D the 2nd, G the 5th, A the 6th.
// That name stays with the position for every scale, so the label deliberately does not equal the
// index + 1. Index 2 isn't offered (it's the one position the scales disagree on: the 3rd in
// Tizita major, the 4th in Ambasel major).
export const DEGREES = [
    { value: 0, label: '1st' },
    { value: 1, label: '2nd' },
    { value: 3, label: '5th' },
    { value: 4, label: '6th' },
]

const scaleById = new Map(SCALES.map(s => [s.id, s]))

export const getScale = (id) => scaleById.get(id)

export const rotate = (steps, degree) => [...steps.slice(degree), ...steps.slice(0, degree)]

// Semitones from the scale's root up to the given degree.
export const degreeOffset = (steps, degree) => steps.slice(0, degree).reduce((a, b) => a + b, 0)

// Keys (indices into `notes`) for one run: the start note plus one per step.
// A run spans 12 semitones and the start is reduced to 0–11, so it always fits on the 25 keys.
export const getScaleKeys = (steps, startPc) => {
    const keys = [((startPc % 12) + 12) % 12]
    steps.forEach(step => keys.push(keys[keys.length - 1] + step))
    return keys
}

// Play scale `scaleId` from the given degree, where `root` (0–11) is the pitch class of degree 0.
export const getScaleRun = (scaleId, degree, root = 0) => {
    const scale = getScale(scaleId)
    if (!scale) return null
    const steps = rotate(scale.steps, degree)
    const startPc = root + degreeOffset(scale.steps, degree)
    return { steps, keys: getScaleKeys(steps, startPc) }
}

// "1", "1.5" … in tones (display only; callers add the unit)
export const formatStep = (semitones) => `${semitones / 2}`

// Groups of (scale, degree) pairs that produce the same interval pattern,
// e.g. Tizita major from the 6th == Bati minor from the 1st. Only groups of 2+ are returned.
export const findEquivalentScales = () => {
    const groups = new Map()
    SCALES.forEach(scale => {
        DEGREES.forEach(degree => {
            const steps = rotate(scale.steps, degree.value)
            const key = steps.join(',')
            if (!groups.has(key)) groups.set(key, { steps, entries: [] })
            groups.get(key).entries.push({
                scaleId: scale.id,
                scaleLabel: scale.label,
                degree: degree.value,
                degreeLabel: degree.label,
            })
        })
    })
    return [...groups.values()].filter(g => g.entries.length > 1)
}
