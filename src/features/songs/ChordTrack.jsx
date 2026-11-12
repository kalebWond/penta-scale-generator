import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { FeatureIcon } from '../../components/icons'
import { formatTime, indexAt, pretty } from './timeline'
import { trackLayout } from './track'

const FOLLOW_AT = 0.3       // while playing, the playhead stays this far across the visible track
const MAX_AHEAD = 0.25      // s: how far past the last reported time the playhead may run on its own
const SMALL_STEP_BACK = 0.75 // s: a report this much behind the playhead is clock jitter, not a jump

// After a mouse or touch click, give up focus, so the space bar plays/pauses instead of
// clicking this again. (A keyboard click, e.detail === 0, keeps it.)
export const dropFocus = (e) => { if (e.detail > 0) e.currentTarget.blur() }

// A beat cell. Which one is "now" and which are past is set on the DOM by ChordTrack, in step
// with the playhead, so a cell only re-renders when the song or the simplify toggle changes.
// In edit mode a tap selects the cell (the chord picker opens over it) instead of playing.
const Cell = memo(function Cell({ cell, index, left, onSeek, onSelect, selected }) {
    const cls = [
        'track__cell',
        cell.barStart && 'is-bar',
        cell.kind && `is-${cell.kind}`,
        cell.edited && 'is-edited',
        selected && 'is-selected',
    ].filter(Boolean).join(' ')
    const onClick = (e) => {
        if (onSelect) onSelect(index, e.currentTarget.getBoundingClientRect())
        else {
            dropFocus(e)
            onSeek(cell.t)
        }
    }
    return (
        <button type="button" className={cls} style={{ left }} onClick={onClick}
            aria-label={`Bar ${cell.bar + 1}, ${cell.name ? pretty(cell.name) : 'no chord'}, ${formatTime(cell.t)}`}>
            {cell.kind === 'silence' ? <FeatureIcon name="songs" /> : cell.label && pretty(cell.label)}
        </button>
    )
})

// The song as a strip of bars and beats. While the video plays, the strip slides so the playhead
// keeps its place; paused, it can be scrolled freely. Tapping a beat jumps the video there.
// The YouTube time arrives about ten times a second, so between reports the playhead runs on the
// clock, which keeps the slide smooth; the lit cell follows the playhead, frame by frame.
function ChordTrack({ cells, time, playing, onSeek, beatWidth, rate = 1, onSelect = null, selected = -1 }) {
    const scroller = useRef(null)
    const inner = useRef(null)
    const head = useRef(null)
    const layout = useMemo(() => trackLayout(cells, beatWidth), [cells, beatWidth])

    const clock = useRef({ t: time, at: performance.now() })
    useEffect(() => { clock.current = { t: time, at: performance.now() } }, [time])

    // Light the cell under the playhead.
    const lit = useRef(-1)
    const mark = useCallback((index) => {
        const kids = inner.current?.children
        if (!kids || index === lit.current) return
        if (lit.current >= 0 && lit.current < cells.length) kids[lit.current].classList.remove('is-now')
        if (index >= 0) kids[index].classList.add('is-now')
        lit.current = index
    }, [cells.length])

    // New cells (another song, or simplify toggled): start the marking over.
    useLayoutEffect(() => {
        inner.current?.querySelectorAll('.is-now').forEach(el => el.classList.remove('is-now'))
        lit.current = -1
    }, [cells])

    const place = useCallback((t, follow) => {
        const x = layout.xAt(t)
        if (head.current) head.current.style.transform = `translateX(${x}px)`
        mark(indexAt(cells, t, c => c.t))
        const el = scroller.current
        if (!el) return
        if (follow || x < el.scrollLeft || x > el.scrollLeft + el.clientWidth) {
            el.scrollLeft = x - el.clientWidth * FOLLOW_AT
        }
    }, [layout, cells, mark])

    // Paused: the playhead sits at the time, and a jump that lands out of sight (a tap, the seek
    // bar) brings it into view. Scrolling by hand is left alone.
    useLayoutEffect(() => {
        if (!playing) place(time, false)
    }, [playing, time, place])

    // A tap is a real jump, even a small one backwards, so the playhead may follow it there.
    const jumped = useRef(false)
    const seek = useCallback((t) => {
        jumped.current = true
        onSeek(t)
    }, [onSeek])

    // Playing: every frame, move the playhead, light its cell and slide the strip under it.
    // It never steps back by a little: a report slightly behind the clock is jitter, and
    // following it would flash the previous cell.
    useEffect(() => {
        if (!playing) return undefined
        let frame
        let last = -Infinity
        const tick = () => {
            const { t, at } = clock.current
            let est = t + Math.min(MAX_AHEAD, rate * (performance.now() - at) / 1000)
            if (jumped.current) {
                jumped.current = false
                last = -Infinity
            }
            if (est < last && last - est < SMALL_STEP_BACK) est = last
            last = est
            place(est, true)
            frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [playing, place, rate])

    return (
        <div className={`track${playing ? ' is-playing' : ''}${onSelect ? ' is-editing' : ''}`} ref={scroller}
            style={{ '--beat-w': `${beatWidth}px` }} role="group" aria-label="Chords by bar and beat">
            <div className="track__inner" ref={inner} style={{ width: layout.width }}>
                {cells.map((cell, i) => (
                    <Cell key={i} index={i} cell={cell} left={layout.lefts[i]} onSeek={seek}
                        onSelect={onSelect} selected={i === selected} />
                ))}
                <div className="track__head" ref={head} aria-hidden="true" />
            </div>
        </div>
    )
}

export default ChordTrack
