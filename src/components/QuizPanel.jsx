import { notes } from '../music/notes'
import { LEVELS } from '../quiz/levels'
import { alsoKnownAs, distance } from '../quiz/questions'
import { PlayIcon, StopIcon } from './icons'
import { SpeedField } from './Toolbar'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function Feedback({ question, answer, items }) {
    const { target } = question
    if (answer.correct) {
        const aka = alsoKnownAs(target, items)
        return (
            <p className="quiz__prompt quiz__prompt--right">
                Right: <strong>{target.label}</strong>.
                {aka.length > 0 && <span> Same notes as {aka.map(i => i.label).join(', ')}.</span>}
            </p>
        )
    }
    const d = distance(answer.item, target)
    return (
        <p className="quiz__prompt quiz__prompt--wrong">
            That was <strong>{target.label}</strong>.{' '}
            <span>{answer.item.label} is {plural(d, 'note')} different.</span>
        </p>
    )
}

// The panel above the keys in quiz mode: what to do, the answer buttons, and how you're doing.
function QuizPanel({
    quiz, playing, speed, onSpeed, onStart, onReplay, onStop, onAnswer, onNext, onHearBoth,
    onOpenProgress, modeSwitch,
}) {
    const { question, answer, stats, items } = quiz
    const { level, streak, best } = stats.progress

    return (
        <>
            <header className="toolbar">
                <h1 className="brand">Penta<span>Scales</span></h1>
                {modeSwitch}
                {!question ? (
                    <button type="button" className="btn btn--play" onClick={onStart}><PlayIcon /> Start</button>
                ) : playing ? (
                    <button type="button" className="btn btn--stop" onClick={onStop}><StopIcon /> Stop</button>
                ) : (
                    <button type="button" className="btn btn--play" onClick={onReplay}><PlayIcon /> Replay</button>
                )}
                <SpeedField speed={speed} onSpeed={onSpeed} />
                <p className="quiz__score">
                    <span>Level <b>{level + 1}</b>/{LEVELS.length}</span>
                    <span>Streak <b>{streak}</b></span>
                    <span className="quiz__best">Best <b>{best}</b></span>
                </p>
                <button type="button" className="btn btn--ghost btn--small" onClick={onOpenProgress}>Progress</button>
            </header>

            <section className="quiz" aria-live="polite">
                {!question ? (
                    <p className="quiz__prompt">
                        Listen to a scale, then name it. It starts with a few very different scales
                        and gets harder as you get them right.
                    </p>
                ) : answer ? (
                    <Feedback question={question} answer={answer} items={items} />
                ) : (
                    <p className="quiz__prompt">
                        Which scale is this? <span>Starts on {notes[question.keys[0]].display}</span>
                    </p>
                )}

                {question && (
                    <div className="quiz__choices" role="group" aria-label="Answers">
                        {question.choices.map(choice => {
                            const state = !answer ? ''
                                : choice === question.target ? 'is-right'
                                : choice === answer.item ? 'is-wrong' : 'is-other'
                            return (
                                <button key={choice.id} type="button" className={`choice ${state}`}
                                    disabled={Boolean(answer)} onClick={() => onAnswer(choice)}>
                                    {choice.label}
                                </button>
                            )
                        })}
                    </div>
                )}

                {answer && (
                    <div className="quiz__after">
                        {!answer.correct && (
                            <button type="button" className="btn btn--ghost btn--small" onClick={onHearBoth}
                                title="Your answer first, then the right one, from the same note">
                                <PlayIcon /> Hear both
                            </button>
                        )}
                        <button type="button" className="btn btn--play btn--small" onClick={onNext}>Next</button>
                    </div>
                )}
            </section>
        </>
    )
}

export default QuizPanel
