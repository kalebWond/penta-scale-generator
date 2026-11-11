// The difficulty ladder. Everyone starts at the bottom; a run of right answers moves you up,
// a couple of misses in a row moves you back down. Tune difficulty by editing this table.
//
//  choices      how many answer buttons are offered (Infinity: every distinct-sounding item)
//  minDistance  every pair of choices must differ by at least this many notes when played from
//               the same start. 3+ is easy to tell apart; 1 is Tizita major vs Ambasel major.
//               If the catalog can't supply enough far-apart items, the farthest available are used.
//  fixedRoot    true: every question starts on the same note (the root picked in practice).
//               false: a random start each time, so you have to hear the shape, not the pitches.
export const LEVELS = [
    { choices: 2, minDistance: 3, fixedRoot: true },
    { choices: 3, minDistance: 2, fixedRoot: true },
    { choices: 4, minDistance: 2, fixedRoot: false },
    { choices: 5, minDistance: 1, fixedRoot: false },
    { choices: Infinity, minDistance: 1, fixedRoot: false },
]

export const PROMOTE_AFTER = 4   // right answers in a row (at this level) to move up
export const DEMOTE_AFTER = 2    // wrong answers in a row to move down

export const clampLevel = (level) => Math.min(Math.max(0, level | 0), LEVELS.length - 1)

// Next progress after one answer. `rightRun`/`wrongRun` count answers in a row at the current
// level, and reset when the level changes; `streak` is the visible all-time run of right answers.
export function advance(progress, correct) {
    const { level, streak, best } = progress
    let rightRun = correct ? progress.rightRun + 1 : 0
    let wrongRun = correct ? 0 : progress.wrongRun + 1
    let next = level
    if (rightRun >= PROMOTE_AFTER && level < LEVELS.length - 1) next = level + 1
    if (wrongRun >= DEMOTE_AFTER && level > 0) next = level - 1
    if (next !== level) rightRun = wrongRun = 0
    const newStreak = correct ? streak + 1 : 0
    return { level: next, streak: newStreak, best: Math.max(best, newStreak), rightRun, wrongRun }
}
