import { useEffect } from 'react'
import { noteIndexByCode } from '../music/notes'

// Computer-keyboard piano: one keydown/keyup pair on window, O(1) lookup by physical key.
export function useKeyboardInput(enabled, onPress, onRelease) {
    useEffect(() => {
        if (!enabled) return
        const down = new Map()   // KeyboardEvent.code -> note index

        const onKeyDown = (e) => {
            if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
            if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return
            const index = noteIndexByCode.get(e.code)
            if (index === undefined) return
            e.preventDefault()   // also stops <select> type-ahead from hijacking the key
            if (down.has(e.code)) return
            down.set(e.code, index)
            onPress(index)
        }
        const onKeyUp = (e) => {
            if (!down.has(e.code)) return
            onRelease(down.get(e.code))
            down.delete(e.code)
        }
        const releaseAll = () => {
            down.forEach(index => onRelease(index))
            down.clear()
        }

        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        window.addEventListener('blur', releaseAll)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            window.removeEventListener('blur', releaseAll)
            releaseAll()
        }
    }, [enabled, onPress, onRelease])
}
