import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatTime, indexAt, notePc, pretty } from './timeline'

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'])
const MAJOR = [[0, ''], [2, 'm'], [4, 'm'], [5, ''], [7, ''], [9, 'm'], [11, 'dim']]
const MINOR = [[0, 'm'], [2, 'dim'], [3, ''], [5, 'm'], [7, 'm'], [7, ''], [8, ''], [10, '']]
const MODEL_LABELS = { btc: 'BTC', 'btc-cl': 'BTC CL', chordnet: 'ChordNet' }
const QUALITIES = [{ value: '', label: 'major' }, { value: 'm', label: 'minor' }, { value: 'dim', label: 'dim' }]

// Note names spelled for the song's key: flats in a flat key, sharps otherwise.
const namesFor = (key) => (FLAT_KEYS.has(key) || /b/.test(key ?? '') ? FLATS : SHARPS)

// The chords that belong to the song's key (I ii iii IV V vi vii°, or the minor-key set).
export function keyChords(key) {
    const m = /^([A-G][#b]?)(m?)$/.exec(key ?? '')
    if (!m) return []
    const tonic = notePc(m[1])
    const names = namesFor(key)
    return (m[2] ? MINOR : MAJOR).map(([step, q]) => names[(tonic + step) % 12] + q)
}

// The song's chords, most played first.
function songChords(chords, duration) {
    const time = new Map()
    chords.forEach((c, i) => {
        if (c.c === 'N') return
        const end = chords[i + 1]?.t ?? duration ?? c.t
        time.set(c.c, (time.get(c.c) ?? 0) + Math.max(0, end - c.t))
    })
    return [...time.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
}

const split = (name) => {
    const [chord, bass] = (name ?? '').split('/')
    return { c: chord, bass }
}

// The chord picker for one beat, floating over the track. `cell` is the track cell (its time,
// bar and the chord sounding there); `startsHere` says whether a chord change starts on it.
function ChordPicker({ cell, anchor, song, startsHere, onPick, onClose, onPlayFrom, onLoopBar, looping }) {
    const box = useRef(null)
    const [pos, setPos] = useState({ left: 8, top: 8 })
    const [root, setRoot] = useState(null)
    const [quality, setQuality] = useState('')
    const [bass, setBass] = useState('')
    const names = namesFor(song.key)

    const quick = useMemo(() => {
        const out = []
        for (const n of [...songChords(song.chords, song.duration).slice(0, 8), ...keyChords(song.key)]) {
            if (!out.includes(n)) out.push(n)
        }
        return out.slice(0, 12)
    }, [song.chords, song.duration, song.key])

    // What the other models heard at this beat (from the song file's "suggestions").
    const heard = useMemo(() => Object.entries(song.suggestions ?? {}).map(([model, list]) => {
        const i = indexAt(list, cell.t + 0.05, x => x[0])
        return i >= 0 && list[i][1] !== 'N' ? { model, name: list[i][1] } : null
    }).filter(Boolean), [song.suggestions, cell.t])

    // Above the beat, kept on screen.
    useLayoutEffect(() => {
        const el = box.current
        if (!el || !anchor) return
        const w = el.offsetWidth
        const h = el.offsetHeight
        const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - w / 2), window.innerWidth - w - 8)
        const above = anchor.top - h - 8
        setPos({ left, top: above >= 8 ? above : Math.min(anchor.bottom + 8, window.innerHeight - h - 8) })
    }, [anchor, cell.t])

    // Escape closes it.
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    const pick = (name) => {
        const { c, bass: b } = split(name)
        onPick(b ? { t: cell.t, c, bass: b } : { t: cell.t, c })
    }
    const built = root === null ? null : names[root] + quality + (bass ? `/${bass}` : '')

    return (
        <div className="picker" ref={box} style={pos} role="dialog" aria-label="Choose the chord for this beat">
            <header className="picker__head">
                <span>
                    Bar {cell.bar + 1} · {formatTime(cell.t)} · now <b>{cell.name ? pretty(cell.name) : 'no chord'}</b>
                </span>
                <button type="button" className="picker__close" onClick={onClose} aria-label="Close">×</button>
            </header>

            <div className="picker__row">
                <button type="button" className="btn btn--ghost btn--small" onClick={() => onPlayFrom(cell.t)}>▶ Play from here</button>
                <button type="button" className="btn btn--ghost btn--small" aria-pressed={looping} onClick={onLoopBar}>
                    {looping ? 'Stop looping' : '⟳ Loop this bar'}
                </button>
            </div>

            {heard.length > 0 && (
                <div className="picker__group">
                    <span className="picker__label">Other models heard</span>
                    <div className="picker__chips">
                        {heard.map(h => (
                            <button key={h.model} type="button" className="picker__chip picker__chip--hint" onClick={() => pick(h.name)}>
                                {pretty(h.name)} <small>{MODEL_LABELS[h.model] ?? h.model}</small>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="picker__group">
                <span className="picker__label">In this song and key</span>
                <div className="picker__chips">
                    {quick.map(n => (
                        <button key={n} type="button" className="picker__chip" onClick={() => pick(n)}>{pretty(n)}</button>
                    ))}
                </div>
            </div>

            <div className="picker__group">
                <span className="picker__label">Any chord</span>
                <div className="picker__roots">
                    {names.map((n, i) => (
                        <button key={n} type="button" className="picker__root" aria-pressed={root === i} onClick={() => setRoot(i)}>{pretty(n)}</button>
                    ))}
                </div>
                <div className="picker__row">
                    <div className="seg seg--small" role="group" aria-label="Chord type">
                        {QUALITIES.map(q => (
                            <button key={q.label} type="button" aria-pressed={quality === q.value}
                                className={quality === q.value ? 'is-on' : ''} onClick={() => setQuality(q.value)}>{q.label}</button>
                        ))}
                    </div>
                    <label className="picker__bass">
                        bass
                        <select value={bass} onChange={e => setBass(e.target.value)}>
                            <option value="">same as root</option>
                            {names.map(n => <option key={n} value={n}>{pretty(n)}</option>)}
                        </select>
                    </label>
                    <button type="button" className="btn btn--small picker__use" disabled={!built} onClick={() => pick(built)}>
                        Use {built ? pretty(built) : ''}
                    </button>
                </div>
            </div>

            <div className="picker__row picker__row--end">
                <button type="button" className="btn btn--ghost btn--small" onClick={() => onPick({ t: cell.t, c: 'N' })}>No chord</button>
                {startsHere && (
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => onPick({ t: cell.t, remove: true })}
                        title="The chord before carries on through this beat">No change here</button>
                )}
            </div>
        </div>
    )
}

export default ChordPicker
