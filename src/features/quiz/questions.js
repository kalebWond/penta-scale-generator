import { getScaleKeys } from '../../music/scales'

// Two items sound the same when their interval patterns match: played from the same note they
// are literally the same pitches, so the quiz treats them as one answer.
export const patternKey = (item) => item.steps.join(',')
export const sameSound = (a, b) => patternKey(a) === patternKey(b)

// Semitones above the start for every note before the octave.
const offsets = (steps) => {
    const out = []
    let t = 0
    steps.slice(0, -1).forEach(s => out.push(t += s))
    return out
}

// How many notes differ when both are played from the same start (0 = they sound identical).
// Symmetric, and works for scales of different sizes, so future 6- or 7-note items fit.
export function distance(a, b) {
    const x = offsets(a.steps)
    const y = offsets(b.steps)
    const ys = new Set(y)
    const xs = new Set(x)
    return Math.max(x.filter(o => !ys.has(o)).length, y.filter(o => !xs.has(o)).length)
}

export function shuffle(list, rng = Math.random) {
    const out = [...list]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

// One item per distinct sound, keeping the first in catalog order.
export function distinctSounds(items) {
    const seen = new Set()
    return items.filter(item => !seen.has(patternKey(item)) && seen.add(patternKey(item)))
}

// Items you get wrong more often come up more often. (Laplace-smoothed, so a new item
// isn't treated as either perfect or hopeless.) The previous target is skipped if possible.
export function pickTarget(items, stats, rng = Math.random, previousId = null) {
    const pool = items.length > 1 ? items.filter(i => i.id !== previousId) : items
    const weights = pool.map(item => {
        const s = stats.items[item.id] || { asked: 0, correct: 0 }
        const missRate = (s.asked - s.correct + 1) / (s.asked + 2)
        return 1 + 2 * missRate
    })
    let r = rng() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < pool.length; i++) {
        r -= weights[i]
        if (r < 0) return pool[i]
    }
    return pool[pool.length - 1]
}

// The answer you've most often given for `targetId` when wrong, as an item (or null).
export function topRival(stats, targetId, items) {
    const counts = stats.confusions[targetId]
    if (!counts) return null
    const [best] = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return (best && items.find(i => i.id === best[0])) || null
}

// The answer buttons: the target plus distractors that never sound like it or like each other.
// Distractors keep every pair at least `level.minDistance` notes apart; the scale you most often
// mistake for this one is included first when it qualifies. If the catalog can't supply enough
// far-apart items, the rest are filled with the farthest remaining, so a question always works.
export function pickChoices(target, items, level, stats, rng = Math.random) {
    const others = distinctSounds(items).filter(i => !sameSound(i, target))
    const want = Math.min(level.choices, others.length + 1) - 1
    const chosen = []
    const fits = (c) => !chosen.includes(c) && [target, ...chosen].every(o => distance(c, o) >= level.minDistance)

    const rival = topRival(stats, target.id, items)
    const rivalSound = rival && others.find(o => sameSound(o, rival))
    if (rivalSound && want > 0 && fits(rivalSound)) chosen.push(rivalSound)

    for (const c of shuffle(others, rng)) {
        if (chosen.length >= want) break
        if (fits(c)) chosen.push(c)
    }
    const farthestFirst = shuffle(others, rng).sort((a, b) => distance(b, target) - distance(a, target))
    for (const c of farthestFirst) {
        if (chosen.length >= want) break
        if (!chosen.includes(c)) chosen.push(c)
    }
    return shuffle([target, ...chosen], rng)
}

// A full question: what to play (`keys`, indices into the keyboard) and what to offer.
export function makeQuestion({ items, level, stats, homeRoot = 0, rng = Math.random, previousId = null }) {
    const target = pickTarget(items, stats, rng, previousId)
    const root = level.fixedRoot ? homeRoot : Math.floor(rng() * 12)
    return {
        target,
        root,
        keys: getScaleKeys(target.steps, root),
        choices: pickChoices(target, items, level, stats, rng),
    }
}

// The other catalog names for the sound of `item` (e.g. "also Bati minor from the 1st").
export const alsoKnownAs = (item, items) => items.filter(i => i.id !== item.id && sameSound(i, item))
