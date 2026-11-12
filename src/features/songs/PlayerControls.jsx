import { useRef, useState } from 'react'
import { PauseIcon, PlayIcon, RestartIcon, SkipIcon, VolumeIcon } from '../../components/icons'
import { dropFocus } from './ChordTrack'
import { formatTime } from './timeline'

const SKIP = 10     // s, for the back and forward buttons
const THUMB = 14    // px: the seek bar's handle. Its centre runs from THUMB/2 to width - THUMB/2.

// Where on the seek bar a time sits, in px from its left edge, and the reverse.
const xOfTime = (el, t, duration) =>
    THUMB / 2 + (duration ? Math.min(Math.max(t / duration, 0), 1) : 0) * (el.clientWidth - THUMB)
const timeOfX = (el, x, duration) =>
    Math.min(Math.max((x - THUMB / 2) / Math.max(1, el.clientWidth - THUMB), 0), 1) * duration

// The video's controls, drawn by the page (YouTube's own are hidden). One row on wide screens:
// [restart] [-10] [play] [+10]  0:14 ━━━━━━━━━ 7:07  [sound]. On phones the seek bar gets a row
// of its own under the buttons. The volume slider stands up above the speaker button while the
// pointer is over it, and tucks away when it leaves; tapping the speaker mutes.
function PlayerControls({ yt }) {
    // While the seek bar is being dragged it shows where you are dragging, and the video only
    // jumps when you let go.
    const [dragging, setDragging] = useState(null)
    const dragRef = useRef(null)
    const shown = dragging ?? yt.time
    const duration = yt.duration || 0

    // A time bubble over the seek bar: where the pointer is while it hovers, where the handle is
    // while it's dragged (by pointer, finger or arrow keys). { x: px from the bar's left, t }
    const [hover, setHover] = useState(null)
    const seekEl = useRef(null)
    const tip = dragging !== null && seekEl.current
        ? { x: xOfTime(seekEl.current, dragging, duration), t: dragging }
        : hover

    const onHover = (e) => {
        if (!yt.ready || !duration || e.pointerType === 'touch') return
        const x = e.clientX - e.currentTarget.getBoundingClientRect().left
        setHover({ x, t: timeOfX(e.currentTarget, x, duration) })
    }

    const drag = (value) => {
        dragRef.current = value
        setDragging(value)
    }
    const commit = () => {
        if (dragRef.current === null) return
        yt.seekTo(dragRef.current)
        dragRef.current = null
        setDragging(null)
    }
    const skip = (seconds) => yt.seekTo(Math.min(Math.max(0, yt.time + seconds), Math.max(0, duration - 0.5)))
    const percent = (value, max) => `${max ? (Math.min(value, max) / max) * 100 : 0}%`
    const silent = yt.muted || yt.volume === 0

    return (
        <div className="player" role="group" aria-label="Video controls">
            <button type="button" className="player__btn" disabled={!yt.ready}
                onClick={(e) => { dropFocus(e); yt.seekTo(0); yt.play() }} aria-label="Back to the start" title="Back to the start">
                <RestartIcon />
            </button>
            <button type="button" className="player__btn" disabled={!yt.ready}
                onClick={(e) => { dropFocus(e); skip(-SKIP) }} aria-label="Back 10 seconds" title="Back 10 seconds">
                <SkipIcon />
            </button>
            <button type="button" className="player__btn player__btn--main" disabled={!yt.ready}
                onClick={(e) => { dropFocus(e); if (yt.playing) yt.pause(); else yt.play() }}
                aria-label={yt.playing ? 'Pause' : 'Play'} title={yt.playing ? 'Pause (space)' : 'Play (space)'}>
                {yt.playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" className="player__btn" disabled={!yt.ready}
                onClick={(e) => { dropFocus(e); skip(SKIP) }} aria-label="Forward 10 seconds" title="Forward 10 seconds">
                <SkipIcon forward />
            </button>

            <span className="player__time">{formatTime(shown)}</span>
            <span className="player__seekwrap">
                <input type="range" className="player__seek" aria-label="Seek" disabled={!yt.ready} ref={seekEl}
                    min="0" max={duration} step="0.1" value={Math.min(shown, duration)}
                    aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
                    style={{ '--progress': percent(shown, duration) }}
                    onChange={e => drag(Number(e.target.value))}
                    onPointerMove={onHover} onPointerLeave={() => setHover(null)}
                    onPointerUp={(e) => { commit(); e.currentTarget.blur() }} onKeyUp={commit} onBlur={commit} />
                {tip && (
                    <span className="player__tip" style={{ left: tip.x }} aria-hidden="true">
                        {formatTime(tip.t)}
                    </span>
                )}
            </span>
            <span className="player__time player__time--total">{formatTime(duration)}</span>

            <div className="player__sound">
                <button type="button" className="player__btn" disabled={!yt.ready} aria-pressed={silent}
                    onClick={(e) => { dropFocus(e); yt.setMuted(!yt.muted) }} aria-label={silent ? 'Unmute' : 'Mute'}>
                    <VolumeIcon muted={silent} />
                </button>
                <div className="player__volume-pop">
                    <input type="range" className="player__volume" aria-label="Volume" disabled={!yt.ready}
                        min="0" max="100" step="1" value={yt.muted ? 0 : yt.volume}
                        style={{ '--progress': percent(yt.muted ? 0 : yt.volume, 100) }}
                        onChange={e => yt.setVolume(Number(e.target.value))}
                        onPointerUp={e => e.currentTarget.blur()} />
                </div>
            </div>
        </div>
    )
}

export default PlayerControls
