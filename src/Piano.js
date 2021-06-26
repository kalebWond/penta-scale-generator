import Controls from './Controls';
import { useLayoutEffect, useState } from 'react'
import { getScalePattern, removeTransition, playSoundByKeyboard, playSound, sleep, playKey, mapVariationToStart } from './_helpers';
import KeyPrint from './KeyPrint';

function Piano() {
    const [showKeys, setShowKeys] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false)
    const [touchedKeys, setTouchedKeys] = useState([])

    useLayoutEffect(() => {
        document.addEventListener('keydown', playSoundByKeyboard)
        const keys = Array.from(document.querySelectorAll('.set div'))

        keys.forEach(key => key.addEventListener('mousedown', playSound))
        keys.forEach(key => key.addEventListener('transitionend', removeTransition));
        return () => {
            keys.forEach(key => key.removeEventListener('mousedown', playSound))
            keys.forEach(key => key.removeEventListener('transitionend', removeTransition));
        }
    }, [])
    return (
        <>
            <ul className="set">
                <p onClick={() => setShowKeys(!showKeys)} className={`${showKeys ? '' : 'fade'} key-control`}>
                    <img src={showKeys ? "assets/img/keys_mode_on.png" : "assets/img/keys_mode_off.png"} alt="" className="img" />
                </p>
                <div className="white" data-key="C3" data-code="81">
                    {showKeys && <span className="text">q</span>}
                    <div className="black" data-code="50" data-key="Db3">
                        {showKeys && <span className="text">2</span>}
                    </div>
                </div>
                <div className="white" data-key="D3" data-code="87">
                    {showKeys && <span className="text">w</span>}
                    <div className="black" data-code="51" data-key="Eb3">
                        {showKeys && <span className="text">3</span>}
                    </div>
                </div>
                <div className="white" data-key="E3" data-code="69">
                    {showKeys && <span className="text">e</span>}
                </div>
                <div className="white" data-key="F3" data-code="82">
                    {showKeys && <span className="text">r</span>}
                    <div className="black" data-code="53" data-key="Gb3">
                        {showKeys && <span className="text">5</span>}
                    </div>
                </div>
                <div className="white" data-key="G3" data-code="84">
                    {showKeys && <span className="text">t</span>}
                    <div className="black" data-code="54" data-key="Ab3">
                        {showKeys && <span className="text">6</span>}
                    </div>
                </div>
                <div className="white" data-key="A3" data-code="89">
                    {showKeys && <span className="text">y</span>}
                    <div className="black" data-code="55" data-key="Bb3">
                        {showKeys && <span className="text">7</span>}
                    </div>
                </div>
                <div className="white" data-key="B3" data-code="85">
                    {showKeys && <span className="text">u</span>}
                </div>
                <div className="white" data-key="C4" data-code="73">
                    {showKeys && <span className="text">i</span>}
                    <div className="black" data-code="57" data-key="Db4">
                        {showKeys && <span className="text">9</span>}
                    </div>
                </div>
                <div className="white" data-key="D4" data-code="79">
                    {showKeys && <span className="text">o</span>}
                    <div className="black" data-code="48" data-key="Eb4">
                        {showKeys && <span className="text">0</span>}
                    </div>
                </div>
                <div className="white" data-key="E4" data-code="80">
                    {showKeys && <span className="text">p</span>}
                </div>
                <div className="white" data-key="F4" data-code="90">
                    {showKeys && <span className="text">z</span>}
                    <div className="black" data-code="83" data-key="Gb4">
                        {showKeys && <span className="text">s</span>}
                    </div>
                </div>
                <div className="white" data-key="G4" data-code="88">
                    {showKeys && <span className="text">x</span>}
                    <div className="black" data-code="68" data-key="Ab4">
                        {showKeys && <span className="text">d</span>}
                    </div>
                </div>
                <div className="white" data-key="A4" data-code="67">
                    {showKeys && <span className="text">c</span>}
                    <div className="black" data-code="70" data-key="Bb4">
                        {showKeys && <span className="text">f</span>}
                    </div>
                </div>
                <div className="white" data-key="B4" data-code="86">
                    {showKeys && <span className="text">v</span>}
                </div>
                <div className="white" data-key="C5" data-code="66">
                    {showKeys && <span className="text">b</span>}
                </div>
                <audio src="assets/sounds/"></audio>
            </ul>
            <Controls getControlData={getControlData} />
            { touchedKeys.length > 0 && <KeyPrint showKeys={showKeys} notes={touchedKeys} /> }
        </>
    );

    function getControlData(data) {
        const pattern = getScalePattern(data);
        playScale(pattern, data.variation, data.major)
    }

    async function playScale(pattern, variation, major) {
        if(!pattern || isPlaying) {
            return;
        }
        setIsPlaying(true)
        const keys = Array.from(document.querySelectorAll('.set div'));
        const start = mapVariationToStart(variation) + parseInt(major)
        playKey(keys[start])
        const backwards = [keys[start]]
        let prevSum = start;
        for(let i = 0; i < pattern.length; i++) {
            const note = keys[(pattern[i]*2) + (prevSum)]
            backwards.unshift(note)
            if(i === 2) {
                await sleep(1000)
            } else if(i === 4) {
                await sleep(700)
            } else if(i === 3) {
                await sleep(500)
            } else {
                await sleep(450)
            }
            playKey(note)
            prevSum += pattern[i]*2;
        }
        setTouchedKeys([...backwards].reverse())
        // console.log(backwards); return;
        for (let i = 0; i < backwards.length; i++) {
            const key = backwards[i];
            if(i === 0) {
                await sleep(1500)
            } else if(i === 3) {
                await sleep(800)
            } else if(i === 5) {
                await sleep(850)
            } else {
                await sleep(500)
            }
            playKey(key)
        }
        setIsPlaying(false)
    }
}

export default Piano
