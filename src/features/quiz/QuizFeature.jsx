import { useMemo, useState } from 'react'
import Piano, { NO_ROLES, rolesFor } from '../../components/Piano'
import { useRunPlayer } from '../../hooks/useScalePlayer'
import { getScaleKeys } from '../../music/scales'
import ProgressSheet from './ProgressSheet'
import QuizPanel from './QuizPanel'
import { useQuiz } from './useQuiz'

// Ear training: hear a scale, name it. Difficulty adapts and progress is saved in the browser.
function QuizFeature({ instrument, nav }) {
    const { rootPc, speed, setSpeed, sustain } = instrument
    const quiz = useQuiz(rootPc)
    const player = useRunPlayer()
    const [progressOpen, setProgressOpen] = useState(false)

    // The keys stay unmarked until you've answered -- the markings would give it away.
    const roles = useMemo(
        () => (quiz.question && quiz.answer ? rolesFor(quiz.question.keys) : NO_ROLES),
        [quiz.question, quiz.answer])

    const nextQuestion = () => player.play(quiz.next().keys, speed, sustain)

    // Your answer first, then the right one, both from the question's start note.
    function hearBoth() {
        const { question, answer } = quiz
        player.playRuns([getScaleKeys(answer.item.steps, question.root), question.keys], speed, sustain)
    }

    const panel = (
        <QuizPanel quiz={quiz} playing={player.playing} speed={speed} onSpeed={setSpeed}
            onStart={nextQuestion} onNext={nextQuestion}
            onReplay={() => player.play(quiz.question.keys, speed, sustain)}
            onStop={player.stop} onAnswer={quiz.submit} onHearBoth={hearBoth}
            onOpenProgress={() => setProgressOpen(true)}
            nav={nav} />
    )

    return (
        <Piano instrument={instrument} panel={panel} roles={roles} lit={player.lit}>
            {progressOpen && (
                <ProgressSheet stats={quiz.stats} items={quiz.items} onReset={quiz.reset}
                    onClose={() => setProgressOpen(false)} />
            )}
        </Piano>
    )
}

export default QuizFeature
