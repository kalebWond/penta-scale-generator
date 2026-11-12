import { isLoaded } from '../audio/engine'
import { notes } from '../music/notes'
import Keyboard from './Keyboard'

export const NO_ROLES = new Map()
export const NO_KEYS = new Set()

// Every key belonging to the run's notes (both octaves) gets marked; the start note stands out.
export function rolesFor(keys) {
    const startPc = keys[0] % 12
    const pcs = new Set(keys.map(k => k % 12))
    const map = new Map()
    notes.forEach(n => { if (pcs.has(n.pc)) map.set(n.index, n.pc === startPc ? 'start' : 'scale') })
    return map
}

// The instrument every feature shares: the case, a panel for the feature's controls, and the
// keyboard. A feature decides which keys are marked (`roles`) and held down (`lit`); what the
// player presses comes from `instrument`. `wide` gives the panel the room (a song's video).
// Children are the feature's overlays (sheets), drawn above the whole app.
function Piano({ instrument, panel, roles = NO_ROLES, lit = NO_KEYS, wide = false, children }) {
    return (
        <>
            <div className={`piano${wide ? ' piano--song' : ''}`}>
                <div className="piano__panel">{panel}</div>
                <div className="piano__bed">
                    <Keyboard pressed={instrument.pressed} lit={lit} roles={roles}
                        showLabels={instrument.showLabels} isReady={isLoaded}
                        onPress={instrument.press} onRelease={instrument.release} />
                </div>
            </div>
            {children}
        </>
    )
}

export default Piano
