import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import Keyboard from './components/Keyboard'
import Toolbar from './components/Toolbar'
import ScaleReadout from './components/ScaleReadout'
import EquivalentScales from './components/EquivalentScales'
import StartGate from './components/StartGate'
import QuizPanel from './components/QuizPanel'
import ProgressSheet from './components/ProgressSheet'
import ChordsPanel from './components/ChordsPanel'
import { ModeSwitch } from './components/Segmented'
import { useKeyboardInput } from './hooks/useKeyboardInput'
import { useScalePlayer } from './hooks/useScalePlayer'
import { useMode } from './hooks/useMode'
import { useQuiz } from './hooks/useQuiz'
import { useSong, useSongIndex } from './hooks/useSongs'
import { chordKeys, songScale } from './songs/timeline'
import { isLoaded, loadSamples, noteOff, noteOn } from './audio/engine'
import { NOTE_COUNT, notes } from './music/notes'
import { degreeOffset, getScale, getScaleKeys, getScaleRun } from './music/scales'
import { isTouchDevice } from './lib/orientation'

const NO_ROLES = new Map()

// Every key belonging to the run's notes (both octaves) gets marked; the start note stands out.
function rolesFor(keys) {
    const startPc = keys[0] % 12
    const pcs = new Set(keys.map(k => k % 12))
    const map = new Map()
    notes.forEach(n => { if (pcs.has(n.pc)) map.set(n.index, n.pc === startPc ? 'start' : 'scale') })
    return map
}

const withItem = (set, item) => new Set(set).add(item)
const withoutItem = (set, item) => {
    const next = new Set(set)
    next.delete(item)
    return next
}

function App() {
    const [rootPc, setRootPc] = useState(0)
    const [scaleId, setScaleId] = useState('TIZITA-1')
    const [degree, setDegree] = useState(0)
    const [speed, setSpeed] = useState(1)
    const [showLabels, setShowLabels] = useState(() => !isTouchDevice())
    const [sustain, setSustain] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [progressOpen, setProgressOpen] = useState(false)
    const [mode, setMode, songId] = useMode()
    const quiz = useQuiz(rootPc)
    const songs = useSongIndex(mode === 'chords')
    const song = useSong(mode === 'chords' ? songId : null)
    const [simplify, setSimplify] = useState(false)
    const [currentChord, setCurrentChord] = useState(null)

    const [started, setStarted] = useState(false)
    const [loadedCount, setLoadedCount] = useState(0)
    const [loadDone, setLoadDone] = useState(false)
    const [loadError, setLoadError] = useState(null)

    const [pressed, setPressed] = useState(() => new Set())   // held by the user
    const [lit, setLit] = useState(() => new Set())           // sounding as part of a playing run
    const [step, setStep] = useState(null)

    // `ignore` drops callbacks from a load whose effect was cleaned up (StrictMode's dev double-mount),
    // so the count isn't incremented twice per sample. The engine dedupes the fetches themselves.
    useEffect(() => {
        let ignore = false
        try {
            loadSamples(() => { if (!ignore) setLoadedCount(n => n + 1) },
                (name, e) => { if (!ignore) console.warn(`Sample ${name} failed`, e) })
                .then(() => { if (!ignore) setLoadDone(true) })
        } catch (e) {
            setLoadError(e.message)     // no Web Audio
        }
        return () => { ignore = true }
    }, [])

    const press = useCallback((index) => {
        noteOn(notes[index].name)
        setPressed(s => withItem(s, index))
    }, [])
    // With sustain on, a released key keeps ringing (like holding the pedal) until sustain is turned off.
    const sustainRef = useRef(sustain)
    sustainRef.current = sustain
    const ringing = useRef(new Set())   // keys let go while sustain was on
    const release = useCallback((index) => {
        if (sustainRef.current) ringing.current.add(index)
        else noteOff(notes[index].name)
        setPressed(s => withoutItem(s, index))
    }, [])
    useKeyboardInput(started, press, release)

    const player = useScalePlayer(useCallback((key, stepIndex, isOn) => {
        if (key === null) {
            setLit(new Set())
            setStep(null)
        } else if (isOn) {
            setLit(s => withItem(s, key))
            setStep(stepIndex)
        } else {
            setLit(s => withoutItem(s, key))
        }
    }, []))

    const run = useMemo(() => getScaleRun(scaleId, degree, rootPc), [scaleId, degree, rootPc])

    // In the quiz the keys stay unmarked until you've answered -- the markings would give it away.
    // In chords mode they show the song's scale, and the chord now playing is held down.
    const songData = mode === 'chords' && songId ? song.data : null
    const roles = useMemo(() => {
        if (mode === 'practice') return rolesFor(run.keys)
        if (mode === 'chords') {
            const scale = songScale(songData)
            return scale ? rolesFor(getScaleRun(scale.scaleId, 0, scale.rootPc).keys) : NO_ROLES
        }
        return quiz.question && quiz.answer ? rolesFor(quiz.question.keys) : NO_ROLES
    }, [mode, run, songData, quiz.question, quiz.answer])
    const chordLit = useMemo(() => new Set(chordKeys(currentChord)), [currentChord])

    // Changing what's selected ends any run that's still playing.
    const change = (setter) => (value) => { player.stop(); setter(value) }

    // The back button can change the mode too, so this follows `mode` rather than the switch.
    useEffect(() => {
        player.stop()
        setSheetOpen(false)
        setProgressOpen(false)
    }, [mode, player.stop])

    const nextQuestion = () => player.play(quiz.next().keys, speed, sustain)

    // Your answer first, then the right one, both from the question's start note.
    function hearBoth() {
        const { question, answer } = quiz
        player.playRuns([getScaleKeys(answer.item.steps, question.root), question.keys], speed, sustain)
    }

    // Lifting the pedal damps what it was holding, except keys that are still held down.
    // A playing run was scheduled with the old setting, so it ends here too.
    function toggleSustain() {
        if (player.playing) player.stop()
        if (sustain) {
            ringing.current.forEach(index => { if (!pressed.has(index)) noteOff(notes[index].name) })
            ringing.current.clear()
        }
        setSustain(!sustain)
    }

    function selectEquivalent(entry) {
        const scale = getScale(entry.scaleId)
        const startPc = run.keys[0] % 12
        const root = (((startPc - degreeOffset(scale.steps, entry.degree)) % 12) + 12) % 12
        setScaleId(entry.scaleId)
        setDegree(entry.degree)
        setRootPc(root)
        setSheetOpen(false)
        player.play(getScaleRun(entry.scaleId, entry.degree, root).keys, speed, sustain)
    }

    return (
        <div className="app">
            <div className={`piano${mode === 'chords' && songId ? ' piano--song' : ''}`}>
                <div className="piano__panel">
                    {mode === 'chords' ? (
                        <ChordsPanel songs={songs} songId={songId} song={song}
                            onSelectSong={(id) => setMode('chords', id)}
                            simplify={simplify} onToggleSimplify={() => setSimplify(v => !v)}
                            onChordChange={setCurrentChord}
                            modeSwitch={<ModeSwitch mode={mode} onMode={setMode} />} />
                    ) : mode === 'quiz' ? (
                        <QuizPanel quiz={quiz} playing={player.playing} speed={speed} onSpeed={setSpeed}
                            onStart={nextQuestion} onNext={nextQuestion}
                            onReplay={() => player.play(quiz.question.keys, speed, sustain)}
                            onStop={player.stop} onAnswer={quiz.submit} onHearBoth={hearBoth}
                            onOpenProgress={() => setProgressOpen(true)}
                            modeSwitch={<ModeSwitch mode={mode} onMode={setMode} />} />
                    ) : (
                        <>
                            <Toolbar
                                rootPc={rootPc} onRoot={change(setRootPc)}
                                scaleId={scaleId} onScale={change(setScaleId)}
                                degree={degree} onDegree={change(setDegree)}
                                speed={speed} onSpeed={setSpeed}
                                playing={player.playing} onPlay={() => player.play(run.keys, speed, sustain)} onStop={player.stop}
                                modeSwitch={<ModeSwitch mode={mode} onMode={setMode} />} />
                            <ScaleReadout scaleId={scaleId} degree={degree} run={run} step={step}
                                showLabels={showLabels} onToggleLabels={() => setShowLabels(v => !v)}
                                sustain={sustain} onToggleSustain={toggleSustain}
                                onOpenEquivalents={() => setSheetOpen(true)} />
                        </>
                    )}
                </div>
                <div className="piano__bed">
                    <Keyboard pressed={pressed} lit={mode === 'chords' ? chordLit : lit} roles={roles}
                        showLabels={showLabels}
                        isReady={isLoaded} onPress={press} onRelease={release} />
                </div>
            </div>
            {progressOpen && (
                <ProgressSheet stats={quiz.stats} items={quiz.items} onReset={quiz.reset}
                    onClose={() => setProgressOpen(false)} />
            )}
            {sheetOpen && (
                <EquivalentScales startPc={run.keys[0] % 12} onSelect={selectEquivalent}
                    onClose={() => setSheetOpen(false)} />
            )}
            {!started && (
                <StartGate loaded={loadedCount} total={NOTE_COUNT} done={loadDone} error={loadError}
                    onStart={() => setStarted(true)} />
            )}
        </div>
    )
}

export default App
