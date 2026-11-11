import { advance, clampLevel } from './levels'

// Everything the quiz remembers between visits. Stats are keyed by catalog item id, so adding
// items later just starts them at zero, and ids that disappear are ignored, never an error.
const KEY = 'pentascales.quiz'
const VERSION = 1

export const emptyStats = () => ({
    version: VERSION,
    progress: { level: 0, streak: 0, best: 0, rightRun: 0, wrongRun: 0 },
    items: {},        // id -> { asked, correct }
    confusions: {},   // target id -> { answered id -> times }
})

// Accepts whatever was stored (or nothing) and returns well-formed stats.
export function normalizeStats(raw) {
    const base = emptyStats()
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION) return base
    const progress = { ...base.progress, ...raw.progress }
    progress.level = clampLevel(progress.level)    // the ladder may have been shortened since
    return {
        version: VERSION,
        progress,
        items: raw.items && typeof raw.items === 'object' ? raw.items : {},
        confusions: raw.confusions && typeof raw.confusions === 'object' ? raw.confusions : {},
    }
}

export function recordAnswer(stats, targetId, answerId, correct) {
    const prev = stats.items[targetId] || { asked: 0, correct: 0 }
    const confusions = correct ? stats.confusions : {
        ...stats.confusions,
        [targetId]: {
            ...stats.confusions[targetId],
            [answerId]: ((stats.confusions[targetId] || {})[answerId] || 0) + 1,
        },
    }
    return {
        ...stats,
        progress: advance(stats.progress, correct),
        items: { ...stats.items, [targetId]: { asked: prev.asked + 1, correct: prev.correct + (correct ? 1 : 0) } },
        confusions,
    }
}

// The most frequent mix-ups, among items still in the catalog: [{ target, answer, count }].
export function topConfusions(stats, items, limit = 3) {
    const byId = new Map(items.map(i => [i.id, i]))
    const rows = []
    Object.entries(stats.confusions).forEach(([t, answers]) => {
        Object.entries(answers).forEach(([a, count]) => {
            if (byId.has(t) && byId.has(a)) rows.push({ target: byId.get(t), answer: byId.get(a), count })
        })
    })
    return rows.sort((x, y) => y.count - x.count).slice(0, limit)
}

// Storage can be missing, full or blocked (private mode): the quiz works either way, just unsaved.
export function loadStats(storage = globalThis.localStorage) {
    try {
        return normalizeStats(JSON.parse(storage.getItem(KEY)))
    } catch (e) {
        return emptyStats()
    }
}

export function saveStats(stats, storage = globalThis.localStorage) {
    try {
        storage.setItem(KEY, JSON.stringify(stats))
    } catch (e) { /* not saved this time */ }
}
