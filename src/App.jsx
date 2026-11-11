import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import StartGate from './components/StartGate'
import { ModeSwitch } from './components/Segmented'
import QuizFeature from './features/quiz/QuizFeature'
import ScalesFeature from './features/scales/ScalesFeature'
import SongsFeature from './features/songs/SongsFeature'
import { useKeyboardInput } from './hooks/useKeyboardInput'
import { useRoute } from './hooks/useRoute'
import { loadSamples, noteOff, noteOn } from './audio/engine'
import { NOTE_COUNT, notes } from './music/notes'
import { isTouchDevice } from './lib/orientation'

// The component for each feature in features/registry.js.
const FEATURE_COMPONENTS = {
    scales: ScalesFeature,
    quiz: QuizFeature,
    songs: SongsFeature,
}

const withItem = (set, item) => new Set(set).add(item)
const withoutItem = (set, item) => {
    const next = new Set(set)
    next.delete(item)
    return next
}

// The app shell: loads the sounds, owns the instrument every feature shares (keys held, the
// pedal, speed, labels, the home key), and shows the feature the address points to.
function App() {
    const [route, go] = useRoute()

    const [started, setStarted] = useState(false)
    const [loadedCount, setLoadedCount] = useState(0)
    const [loadDone, setLoadDone] = useState(false)
    const [loadError, setLoadError] = useState(null)

    const [rootPc, setRootPc] = useState(0)
    const [speed, setSpeed] = useState(1)
    const [showLabels, setShowLabels] = useState(() => !isTouchDevice())
    const [sustain, setSustain] = useState(false)
    const [pressed, setPressed] = useState(() => new Set())   // held by the player

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

    // Lifting the pedal damps what it was holding, except keys that are still held down.
    function toggleSustain() {
        if (sustain) {
            ringing.current.forEach(index => { if (!pressed.has(index)) noteOff(notes[index].name) })
            ringing.current.clear()
        }
        setSustain(!sustain)
    }

    const instrument = {
        pressed, press, release,
        showLabels, toggleLabels: () => setShowLabels(v => !v),
        sustain, toggleSustain,
        speed, setSpeed,
        rootPc, setRootPc,
    }

    const Feature = FEATURE_COMPONENTS[route.id]
    const nav = (
        <>
            <h1 className="brand">Penta<span>Scales</span></h1>
            <ModeSwitch mode={route.id} onMode={go} />
        </>
    )

    return (
        <div className="app">
            <Feature key={route.id} instrument={instrument} nav={nav} param={route.param} go={go} />
            {!started && (
                <StartGate loaded={loadedCount} total={NOTE_COUNT} done={loadDone} error={loadError}
                    onStart={() => setStarted(true)} />
            )}
        </div>
    )
}

export default App
