import { memo, useCallback, useRef } from 'react'
import { notes, whiteNotes } from '../music/notes'

const WHITE_W = 100 / whiteNotes.length      // % of the keyboard width
const BLACK_W = WHITE_W * 0.6
const whiteIndex = new Map(whiteNotes.map((n, i) => [n.index, i]))

// Keys are positioned in % so the keyboard fills whatever width it's given.
const layout = notes.map(n => n.isBlack
    ? { left: (whiteIndex.get(n.index - 1) + 1) * WHITE_W - BLACK_W / 2, width: BLACK_W }
    : { left: whiteIndex.get(n.index) * WHITE_W, width: WHITE_W })

const Key = memo(function Key({ note, down, role, showLabel, ready }) {
    const { left, width } = layout[note.index]
    const cls = [
        'key',
        note.isBlack ? 'key--black' : 'key--white',
        down && 'is-down',
        role && `is-${role}`,
        !ready && 'is-loading',
    ].filter(Boolean).join(' ')
    return (
        <div className={cls} data-note={note.index} style={{ left: `${left}%`, width: `${width}%` }}
            role="button" aria-label={`${note.display}${note.octave}`} aria-pressed={down}>
            {showLabel && <span className="key__kbd">{note.label}</span>}
            {role && <span className="key__note">{note.display}</span>}
        </div>
    )
})

const noteAt = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const key = el && el.closest('[data-note]')
    return key ? Number(key.dataset.note) : null
}

// One set of pointer handlers for the whole keyboard (event delegation).
// Every finger/mouse is tracked by pointerId, so chords work, and sliding across keys plays a glissando.
function Keyboard({ pressed, lit, roles, showLabels, isReady, onPress, onRelease }) {
    const pointers = useRef(new Map())   // pointerId -> note index currently under it

    const down = useCallback((e) => {
        const index = noteAt(e)
        if (index === null) return
        e.currentTarget.setPointerCapture(e.pointerId)
        pointers.current.set(e.pointerId, index)
        onPress(index)
    }, [onPress])

    const move = useCallback((e) => {
        if (!pointers.current.has(e.pointerId)) return
        const from = pointers.current.get(e.pointerId)
        const to = noteAt(e)
        if (to === from) return
        pointers.current.set(e.pointerId, to)
        if (from !== null) onRelease(from)
        if (to !== null) onPress(to)
    }, [onPress, onRelease])

    const up = useCallback((e) => {
        if (!pointers.current.has(e.pointerId)) return
        const from = pointers.current.get(e.pointerId)
        pointers.current.delete(e.pointerId)
        if (from !== null) onRelease(from)
    }, [onRelease])

    return (
        <div className="keyboard" onPointerDown={down} onPointerMove={move} onPointerUp={up}
            onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
            {notes.map(note => (
                <Key key={note.index} note={note}
                    down={pressed.has(note.index) || lit.has(note.index)}
                    role={roles.get(note.index)}
                    showLabel={showLabels}
                    ready={isReady(note.name)} />
            ))}
        </div>
    )
}

export default Keyboard
