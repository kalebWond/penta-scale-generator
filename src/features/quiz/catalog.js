import { DEGREES, getScale, rotate } from '../../music/scales'

// What the quiz can ask about. Each entry names a scale and the degree it's played from.
// Today that's every scale from the 1st. A variation -- a scale from another start position, or a
// new scale added to SCALES -- is one more line here: questions, scoring, stats and the answer
// buttons all work from this list and nothing else needs to change.
//
// Entries that sound identical (the same interval pattern, like Tizita major from the 6th and
// Bati minor from the 1st) are allowed: they're never offered side by side, and either name is
// accepted as the answer. Ids are what stats are saved under, so keep them stable once shipped.
export const QUIZ_ENTRIES = [
    { scaleId: 'TIZITA-1' },
    { scaleId: 'TIZITA-1', degree: 1, label: 'Tizita major 2nd' },   // widely used in its own right
    { scaleId: 'TIZITA-2' },
    { scaleId: 'AMBASEL-1' },
    { scaleId: 'AMBASEL-2' },
    { scaleId: 'BATI-1' },
    { scaleId: 'BATI-2' },
    { scaleId: 'ANCHOYE' },
]

// An entry resolved into what the quiz needs: a stable id, a display label and the interval steps.
// `label` can be given to override the default ("Tizita major", or "Tizita major from the 6th").
export function toQuizItem({ scaleId, degree = 0, label }) {
    const scale = getScale(scaleId)
    if (!scale) throw new Error(`Quiz entry names an unknown scale: ${scaleId}`)
    const degreeInfo = DEGREES.find(d => d.value === degree)
    if (!degreeInfo) throw new Error(`Quiz entry ${scaleId} names an unknown degree: ${degree}`)
    return {
        id: degree === 0 ? scaleId : `${scaleId}@${degree}`,
        scaleId,
        degree,
        label: label || (degree === 0 ? scale.label : `${scale.label} from the ${degreeInfo.label}`),
        steps: rotate(scale.steps, degree),
    }
}

export const QUIZ_ITEMS = QUIZ_ENTRIES.map(toQuizItem)
