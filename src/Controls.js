import { useState } from 'react'
import Select from 'react-select';
import { majors, scales, variations } from './_helpers';

function Controls({getControlData}) {
    const [major, setMajor] = useState('')
    const [scale, setScale] = useState('TIZITA-1')
    const [variation, setVariation] = useState("")

    return (
        <div className="controls">
            <Select
                className="basic-single basic-select"
                classNamePrefix="select"
                placeholder="Choose pentatonic major"
                classNamePrefix="select"
                defaultValue={majors[0]}
                isClearable={false}
                isSearchable={false}
                name="major"
                options={majors}
                menuPosition="fixed"
                value={major}
                onChange={(option) => setMajor(option)}
                />
            <Select
                className="basic-single basic-select"
                classNamePrefix="select"
                placeholder="Choose scale"
                classNamePrefix="select"
                defaultValue={scales[0]}
                isClearable={false}
                isSearchable={false}
                name="scale"
                options={scales}
                menuPosition="fixed"
                value={scale}
                onChange={(option) => setScale(option)}
                />
            <Select
                className="basic-single basic-select"
                classNamePrefix="select"
                placeholder="Choose variation"
                classNamePrefix="select"
                defaultValue={variations[0]}
                isClearable={false}
                isSearchable={false}
                name="variation"
                options={variations}
                menuPosition="fixed"
                value={variation}
                onChange={(option) => setVariation(option)}
                />
            <button className="btn" onClick={clickHandler}>Play</button>
        </div>
    )

    function clickHandler() {
        getControlData({major: major.value || 0, scale: scale.value, variation: variation.value || 0})
    }
}

export default Controls

