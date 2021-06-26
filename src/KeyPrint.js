import React from 'react'

function KeyPrint({ notes, pattern }) {
    return (
        <div className="controls controls--prints" style={{marginTop: "2em"}}>
            <div>
                { 
                    notes.map((note, i) => (<span key={i} className="letter">{note && note.dataset.key}</span>))
                }
            </div>
            {
                pattern && (<div className="pattern">
                    { 
                        pattern.map((note, i) => (<span key={i} className="letter letter--small">{note}Tone</span>))
                    }
                </div>)
            }
        </div>
    )
}

export default KeyPrint
