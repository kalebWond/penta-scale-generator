import { useState } from 'react'

function Controls({getControlData}) {
    const [scale, setScale] = useState('TIZITA-1')
    const [variation, setVariation] = useState("")
    return (
        <div className="controls">
            <div>
                <select value={scale} onChange={({target}) => setScale(target.value)} id="standard-select">
                    <option disabled value="">Select scale</option>
                    <option value="TIZITA-1">Tizita major</option>
                    <option value="TIZITA-2">Tizita minor</option>
                    <option value="AMBASEL-1">Ambasel major</option>
                    <option value="AMBASEL-2">Ambasel minor</option>
                    <option value="BATI-1">Bati major</option>
                    <option value="BATI-2">Bati minor</option>
                    <option value="ANCHOYE">Anchi hoye lene</option>
                </select>
                <select value={variation} onChange={({target}) => setVariation(parseInt(target.value))} id="standard-select">
                    <option disabled value="">Select variation</option>
                    <option value="0">1st</option>
                    <option value="1">2nd</option>
                    <option value="3">5th</option>
                    <option value="4">6th</option>
                </select>
            </div>
            <button className="btn" onClick={clickHandler}>Play</button>
        </div>
    )

    function clickHandler() {
        getControlData({scale, variation: variation || 0})
    }
}

export default Controls

