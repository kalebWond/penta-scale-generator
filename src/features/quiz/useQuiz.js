import { useCallback, useEffect, useRef, useState } from 'react'
import { QUIZ_ITEMS } from './catalog'
import { LEVELS } from './levels'
import { makeQuestion, sameSound } from './questions'
import { emptyStats, loadStats, recordAnswer, saveStats } from './stats'

// Quiz state: the current question, the answer given to it, and the saved stats.
// `next()` returns the new question straight away so the caller can play it in the same tap.
export function useQuiz(homeRoot) {
    const [stats, setStats] = useState(() => loadStats())
    const [question, setQuestion] = useState(null)
    const [answer, setAnswer] = useState(null)      // { item, correct } once answered

    // Read through a ref so next() stays stable and always sees the latest values.
    const latest = useRef()
    latest.current = { stats, question, homeRoot }

    useEffect(() => { saveStats(stats) }, [stats])

    const next = useCallback(() => {
        const { stats, question, homeRoot } = latest.current
        const q = makeQuestion({
            items: QUIZ_ITEMS,
            level: LEVELS[stats.progress.level],
            stats,
            homeRoot,
            previousId: question && question.target.id,
        })
        setQuestion(q)
        setAnswer(null)
        return q
    }, [])

    // One answer per question. The ref is set synchronously, so a quick double tap can't count
    // twice before the re-render; the stats updater stays pure (StrictMode runs updaters twice).
    const answeredFor = useRef(null)
    const submit = useCallback((item) => {
        const { question } = latest.current
        if (!question || answeredFor.current === question) return
        answeredFor.current = question
        const correct = sameSound(item, question.target)
        setAnswer({ item, correct })
        setStats(s => recordAnswer(s, question.target.id, item.id, correct))
    }, [])

    const reset = useCallback(() => {
        setStats(emptyStats())
        setQuestion(null)
        setAnswer(null)
    }, [])

    return { stats, question, answer, next, submit, reset, items: QUIZ_ITEMS }
}
