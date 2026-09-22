import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import Keyboard from './components/Keyboard'
import Toolbar from './components/Toolbar'
import ScaleReadout from './components/ScaleReadout'
import EquivalentScales from './components/EquivalentScales'
import StartGate from './components/StartGate'
import { useKeyboardInput } from './hooks/useKeyboardInput'
import { useScalePlayer } from './hooks/useScalePlayer'
import { isLoaded, loadSamples, noteOff, noteOn } from './audio/engine'
import { NOTE_COUNT, notes } from './music/notes'
import { degreeOffset, getScale, getScaleRun } from './music/scales'
import { isTouchDevice } from './lib/orientation'

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
    const [sheetOpen, setSheetOpen] = useState(false)

    const [started, setStarted] = useState(false)
    const [loadedCount, setLoadedCount] = useState(0)
    const [loadDone, setLoadDone] = useState(false)
    const [loadError, setLoadError] = useState(null)

    const [pressed, setPressed] = useState(() => new Set())   // held by the user
    const [lit, setLit] = useState(() => new Set())           // sounding as part of a playing run
    const [step, setStep] = useState(null)

    useEffect(() => {
        try {
            loadSamples(() => setLoadedCount(n => n + 1), (name, e) => console.warn(`Sample ${name} failed`, e))
                .then(() => setLoadDone(true))
        } catch (e) {
            setLoadError(e.message)     // no Web Audio
        }
    }, [])

    const press = useCallback((index) => {
        noteOn(notes[index].name)
        setPressed(s => withItem(s, index))
    }, [])
    const release = useCallback((index) => {
        noteOff(notes[index].name)
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

    // Every key belonging to the scale (both octaves) gets marked; the start note stands out.
    const roles = useMemo(() => {
        const startPc = run.keys[0] % 12
        const pcs = new Set(run.keys.map(k => k % 12))
        const map = new Map()
        notes.forEach(n => { if (pcs.has(n.pc)) map.set(n.index, n.pc === startPc ? 'start' : 'scale') })
        return map
    }, [run])

    // Changing what's selected ends any run that's still playing.
    const change = (setter) => (value) => { player.stop(); setter(value) }

    function selectEquivalent(entry) {
        const scale = getScale(entry.scaleId)
        const startPc = run.keys[0] % 12
        const root = (((startPc - degreeOffset(scale.steps, entry.degree)) % 12) + 12) % 12
        setScaleId(entry.scaleId)
        setDegree(entry.degree)
        setRootPc(root)
        setSheetOpen(false)
        player.play(getScaleRun(entry.scaleId, entry.degree, root).keys, speed)
    }

    return (
        <div className="app">
            <div className="piano">
                <div className="piano__panel">
                    <Toolbar
                        rootPc={rootPc} onRoot={change(setRootPc)}
                        scaleId={scaleId} onScale={change(setScaleId)}
                        degree={degree} onDegree={change(setDegree)}
                        speed={speed} onSpeed={setSpeed}
                        playing={player.playing} onPlay={() => player.play(run.keys, speed)} onStop={player.stop} />
                    <ScaleReadout scaleId={scaleId} degree={degree} run={run} step={step}
                        showLabels={showLabels} onToggleLabels={() => setShowLabels(v => !v)}
                        onOpenEquivalents={() => setSheetOpen(true)} />
                </div>
                <div className="piano__bed">
                    <Keyboard pressed={pressed} lit={lit} roles={roles} showLabels={showLabels}
                        isReady={isLoaded} onPress={press} onRelease={release} />
                </div>
            </div>
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
