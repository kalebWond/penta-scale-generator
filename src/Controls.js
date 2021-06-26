import { useState } from 'react'
import Select from 'react-select';
import { majors, scales, variations } from './_helpers';

function Controls({ getControlData }) {
    const [major, setMajor] = useState('')
    const [scale, setScale] = useState('TIZITA-1')
    const [variation, setVariation] = useState("")

    return (
        <div className="controls">
            <Select
                className="basic-single basic-select"
                classNamePrefix="select"
                placeholder="Choose pentatonic major"
                defaultValue={majors[0]}
                isClearable={false}
                isSearchable={false}
                name="major"
                options={[{ value: '', label: 'Select major' }, ...majors]}
                menuPosition="fixed"
                value={major}
                onChange={(option) => setMajor(option)}
            />
            <Select
                className="basic-single basic-select"
                classNamePrefix="select"
                placeholder="Choose scale"
                defaultValue={scales[0]}
                isClearable={false}
                isSearchable={false}
                name="scale"
                options={[{ value: '', label: 'Select scale' }, ...scales]}
                menuPosition="fixed"
                value={scale}
                onChange={(option) => setScale(option)}
            />
            <Select
                className="basic-single basic-select"
                classNamePrefix="select"
                placeholder="Choose variation"
                defaultValue={variations[0]}
                isClearable={false}
                isSearchable={false}
                name="variation"
                options={[{ value: '', label: 'Select variation' }, ...variations]}
                menuPosition="fixed"
                value={variation}
                onChange={(option) => setVariation(option)}
            />
            <button className="btn" onClick={clickHandler}>Play</button>
        </div>
    )

    function clickHandler() {
        getControlData({ major: major.value || 0, scale: scale.value, variation: variation.value || 0 })
    }
}

export default Controls

