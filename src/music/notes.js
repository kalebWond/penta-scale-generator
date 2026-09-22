// The keyboard is fixed: C3 … C5, 25 keys. Index 0 is C3, so `index % 12` is the pitch class.
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const BLACK = new Set([1, 3, 6, 8, 10])

// Physical keys (KeyboardEvent.code), in note order. Same q-w-e… / 2-3-5… layout as before.
const CODES = [
    'KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU',
    'KeyI', 'Digit9', 'KeyO', 'Digit0', 'KeyP', 'KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyF', 'KeyV',
    'KeyB',
]

export const NOTE_COUNT = CODES.length

export const notes = CODES.map((code, index) => {
    const pc = index % 12
    return {
        index,
        pc,
        name: `${NAMES[pc]}${3 + Math.floor(index / 12)}`,     // sample id, e.g. "Db3"
        display: NAMES[pc].replace('b', '♭'),                    // "D♭"
        octave: 3 + Math.floor(index / 12),
        isBlack: BLACK.has(pc),
        code,
        label: code.replace(/^(Key|Digit)/, '').toLowerCase(),
    }
})

export const whiteNotes = notes.filter(n => !n.isBlack)

export const noteIndexByCode = new Map(notes.map(n => [n.code, n.index]))

export const ROOTS = NAMES.map((name, i) => ({ value: i, label: name.replace('b', '♭') }))
