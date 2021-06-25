import { useState } from 'react'

function Controls({getControlData}) {
    const [scale, setScale] = useState('')
    return (
        <div className="controls">
            <div>
                <select value={scale} onChange={(({target}) => setScale(target.value))} id="standard-select">
                    <option disabled value="">Select scale</option>
                    <option value="TIZITA-1">Tizita major</option>
                    <option value="TIZITA-2">Tizita minor</option>
                    <option value="AMBASEL-1">Ambasel major</option>
                    <option value="AMBASEL-2">Ambasel minor</option>
                    <option value="BATI-1">Bati major</option>
                    <option value="BATI-2">Bati minor</option>
                    <option value="ANCHOYE">Anchi hoye lene</option>
                </select>
                <span className="focus"></span>
            </div>
            <button onClick={clickHandler}>Play</button>
        </div>
    )

    function clickHandler() {
        getControlData({scale})
    }
}

export default Controls

