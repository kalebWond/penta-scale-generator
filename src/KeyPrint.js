import React from 'react'

function KeyPrint({ notes }) {
    return (
        <div className="controls">
            { 
                notes.map((note, i) => (<span key={i} className="letter">{note && note.dataset.key}</span>))
            // showKeys ? (notes.map((note, i) => (<span key={i} className="letter">{note.firstElementChild.innerText}</span>))) 
            // : (notes.map((note, i) => (<span key={i} className="letter">{note.dataset.key}</span>)))
            }
        </div>
    )
}

export default KeyPrint
