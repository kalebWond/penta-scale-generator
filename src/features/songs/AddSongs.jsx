import { useRef, useState } from 'react'
import { useStickyState } from '../../hooks/useStickyState'
import { formatTime } from './timeline'
import { useIngest } from './useIngest'

// The analysis steps, as tools/analyze.py reports them ("» <stage>").
const STAGES = {
    starting: 'Starting',
    checking: 'Checking',
    downloading: 'Downloading the audio',
    converting: 'Reading the file',
    beats: 'Finding the beats',
    chords: 'Finding the chords',
    notes: 'Listening for the notes',
    'other models': 'Trying the other chord models',
    processing: 'Building the chord track',
    saving: 'Saving',
}

const ACCEPT = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.webm'
const isAudio = (file) => file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i.test(file.name)

function JobRow({ job, now, onOpen, onCancel, onRetry, onDismiss }) {
    const running = job.status === 'running'
    let status
    if (job.status === 'queued') status = 'Waiting'
    else if (running) status = `${STAGES[job.stage] ?? job.stage ?? 'Working'}… ${formatTime((now - job.startedAt) / 1000)}`
    else if (job.status === 'done') status = `Done in ${formatTime((job.finishedAt - job.startedAt) / 1000)}`
    else if (job.status === 'cancelled') status = 'Stopped'
    else if (job.exists) status = 'Already analyzed. Open it, or analyze it again.'
    else status = job.error ?? 'Failed'
    const already = job.status === 'failed' && job.exists

    return (
        <li className={`ingest__job is-${already ? 'exists' : job.status}`}>
            <span className="ingest__dot" aria-hidden="true" />
            <span className="ingest__jobtext">
                <span className="ingest__jobtitle" title={job.input}>{job.title || job.input}</span>
                <span className="ingest__jobstatus" role={job.status === 'failed' && !already ? 'alert' : undefined}>{status}</span>
            </span>
            <span className="ingest__jobactions">
                {(job.status === 'done' || already) && job.songId && (
                    <button type="button" className="btn btn--small ingest__go" onClick={() => onOpen(job.songId)}>Open</button>
                )}
                {already && job.kind === 'link' && (
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => onRetry(job)}>Re-analyze</button>
                )}
                {(job.status === 'queued' || running) && (
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => onCancel(job.id)}>Stop</button>
                )}
                {!(job.status === 'queued' || running) && (
                    <button type="button" className="ingest__dismiss" onClick={() => onDismiss(job.id)}
                        aria-label="Remove from the list" title="Remove from the list">×</button>
                )}
            </span>
        </li>
    )
}

// "Add songs": paste YouTube links or drop audio files, and the dev server analyzes them one
// at a time (tools/ingest-server.js runs tools/analyze.py). Dev only: the deployed site can't
// analyze, and the panel hides itself when there's no analysis server.
function AddSongs({ onOpen }) {
    const ingest = useIngest()
    const [open, setOpen] = useStickyState('songs.addOpen', true)
    const [text, setText] = useState('')
    const [force, setForce] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [hidden, setHidden] = useState(() => new Set())
    const picker = useRef(null)

    if (!ingest.available && !ingest.reason) return null

    const submitLinks = (e) => {
        e.preventDefault()
        if (!text.trim()) return
        ingest.addLinks(text, force)
        setText('')
    }
    const takeFiles = (list) => {
        const files = [...list].filter(isAudio)
        if (files.length) ingest.addFiles(files, force)
    }
    const onDrop = (e) => {
        e.preventDefault()
        setDragging(false)
        takeFiles(e.dataTransfer.files)
    }
    const jobs = ingest.jobs.filter(j => !hidden.has(j.id)).slice().reverse()
    const active = ingest.jobs.filter(j => j.status === 'queued' || j.status === 'running').length
    const now = Date.now()

    return (
        <section className="ingest">
            <button type="button" className="ingest__head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
                <span className="ingest__title">Add songs</span>
                {active > 0 && <span className="ingest__badge">{active} analyzing</span>}
                <span className="ingest__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
            </button>

            {open && (
                <div className="ingest__body">
                    {!ingest.available && <p className="ingest__error" role="alert">{ingest.reason}</p>}

                    <form className="ingest__links" onSubmit={submitLinks}>
                        {/* A text area, not an input: an input drops the line breaks of a pasted list. */}
                        <textarea className="ingest__input" value={text} onChange={e => setText(e.target.value)}
                            rows={Math.min(5, Math.max(1, text.split('\n').length))}
                            placeholder="Paste YouTube links: one per line, or separated by spaces or commas"
                            aria-label="YouTube links" disabled={!ingest.available}
                            onKeyDown={(e) => {
                                // Enter analyzes; Shift+Enter starts a new line
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    e.currentTarget.form.requestSubmit()
                                }
                            }} />
                        <button type="submit" className="btn btn--small ingest__go" disabled={!ingest.available || !text.trim()}>
                            Analyze
                        </button>
                    </form>

                    <div className={`ingest__drop${dragging ? ' is-over' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                        onDragLeave={() => setDragging(false)} onDrop={onDrop}>
                        Drop audio files here, or{' '}
                        <button type="button" className="ingest__pick" disabled={!ingest.available}
                            onClick={() => picker.current?.click()}>choose files</button>
                        <input ref={picker} type="file" accept={ACCEPT} multiple hidden
                            onChange={(e) => { takeFiles(e.target.files); e.target.value = '' }} />
                        <span className="ingest__note">Files stay on this computer: they're never part of the site.</span>
                    </div>

                    <label className="ingest__force">
                        <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
                        Re-analyze songs that are already here
                    </label>

                    {ingest.error && <p className="ingest__error" role="alert">{ingest.error}</p>}

                    {(ingest.uploads.length > 0 || jobs.length > 0) && (
                        <ul className="ingest__jobs">
                            {ingest.uploads.map(u => (
                                <li key={u.key} className="ingest__job is-running">
                                    <span className="ingest__dot" aria-hidden="true" />
                                    <span className="ingest__jobtext">
                                        <span className="ingest__jobtitle">{u.name}</span>
                                        <span className="ingest__jobstatus">Uploading…</span>
                                    </span>
                                </li>
                            ))}
                            {jobs.map(job => (
                                <JobRow key={job.id} job={job} now={now} onOpen={onOpen}
                                    onCancel={ingest.cancel}
                                    onRetry={(j) => ingest.addLinks(j.input, true)}
                                    onDismiss={(id) => setHidden(h => new Set(h).add(id))} />
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    )
}

export default AddSongs
