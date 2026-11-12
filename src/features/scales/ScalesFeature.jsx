import { useMemo, useState } from 'react'
import Piano, { rolesFor } from '../../components/Piano'
import { useRunPlayer } from '../../hooks/useScalePlayer'
import { useStickyState } from '../../hooks/useStickyState'
import { degreeOffset, getScale, getScaleRun } from '../../music/scales'
import EquivalentScales from './EquivalentScales'
import ScaleReadout from './ScaleReadout'
import Toolbar from './Toolbar'

// Pick a scale, a key and a start position; hear the run and see it on the keys.
function ScalesFeature({ instrument, nav }) {
    const { rootPc, setRootPc, speed, setSpeed, sustain } = instrument
    const [scaleId, setScaleId] = useStickyState('scales.scaleId', 'TIZITA-1')
    const [degree, setDegree] = useStickyState('scales.degree', 0)
    const [sheetOpen, setSheetOpen] = useState(false)
    const player = useRunPlayer()

    const run = useMemo(() => getScaleRun(scaleId, degree, rootPc), [scaleId, degree, rootPc])
    const roles = useMemo(() => rolesFor(run.keys), [run])

    // Changing what's selected ends any run that's still playing.
    const change = (setter) => (value) => { player.stop(); setter(value) }

    // A run was scheduled with the old pedal setting, so it ends here too.
    function toggleSustain() {
        if (player.playing) player.stop()
        instrument.toggleSustain()
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

    const panel = (
        <>
            <Toolbar
                rootPc={rootPc} onRoot={change(setRootPc)}
                scaleId={scaleId} onScale={change(setScaleId)}
                degree={degree} onDegree={change(setDegree)}
                speed={speed} onSpeed={setSpeed}
                playing={player.playing} onPlay={() => player.play(run.keys, speed, sustain)} onStop={player.stop}
                nav={nav} />
            <ScaleReadout scaleId={scaleId} degree={degree} run={run} step={player.step}
                showLabels={instrument.showLabels} onToggleLabels={instrument.toggleLabels}
                sustain={sustain} onToggleSustain={toggleSustain}
                onOpenEquivalents={() => setSheetOpen(true)} />
        </>
    )

    return (
        <Piano instrument={instrument} panel={panel} roles={roles} lit={player.lit}>
            {sheetOpen && (
                <EquivalentScales startPc={run.keys[0] % 12} onSelect={selectEquivalent}
                    onClose={() => setSheetOpen(false)} />
            )}
        </Piano>
    )
}

export default ScalesFeature
