import { useState } from "react"

function SpeedControl({onRateChange}) {
    const [speed, setSpeed] = useState('normal')

    return (
        <div className={`speed speed-${speed}`}>
            <div onClick={(e) => changeHandler('slow', e)} 
                className={`speed-control ${speed === 'slow' ? 'speed-control-active' : ''}`}>0.75</div>
            <div onClick={(e) => changeHandler('normal', e)} 
                className={`speed-control ${speed === 'normal' ? 'speed-control-active' : ''}`}>1</div>
            <div onClick={(e) => changeHandler('fast', e)} 
                className={`speed-control ${speed === 'fast' ? 'speed-control-active' : ''}`}>1.25</div>
        </div>
    )

    function changeHandler(rate, e) {
        if(rate === speed) return;
        setSpeed(rate);
        switch (rate) {
            case 'slow':
                onRateChange(1.5)
                break;
            case 'normal':
                onRateChange(1)
                break;
            case 'fast':
                onRateChange(0.5)
                break;
            default:
                onRateChange(1)
                break;
        }
    }
}


export default SpeedControl