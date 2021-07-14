import Controls from './Controls';
import { useLayoutEffect, useState } from 'react'
import { getScalePattern, removeTransition, playSoundByKeyboard, playSound, mapVariationToStart, getKeysTobePlayed, playScaleForward, playScaleBackward } from './_helpers';
import KeyPrint from './KeyPrint';
import Similarity from './Similarity';
import Footer from './Footer';

function Piano() {
    const [showKeys, setShowKeys] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false)
    const [touchedKeys, setTouchedKeys] = useState([])
    const [formula, setFormula] = useState()

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
            <header className="header">
                Learn Pentatonic Scale
            </header>
            <ul className="set">
                <p onClick={() => setShowKeys(!showKeys)} className={`${showKeys ? '' : 'fade'} key-control`}>
                    <img src={showKeys ? "assets/img/keys_mode_on.png" : "assets/img/keys_mode_off.png"} alt="" className="img" />
                </p>
                <div className="white" data-key="C3" data-code="81">
                    {showKeys && <span className="key-text">q</span>}
                    <div className="black" data-code="50" data-key="Db3">
                        {showKeys && <span className="key-text">2</span>}
                    </div>
                </div>
                <div className="white" data-key="D3" data-code="87">
                    {showKeys && <span className="key-text">w</span>}
                    <div className="black" data-code="51" data-key="Eb3">
                        {showKeys && <span className="key-text">3</span>}
                    </div>
                </div>
                <div className="white" data-key="E3" data-code="69">
                    {showKeys && <span className="key-text">e</span>}
                </div>
                <div className="white" data-key="F3" data-code="82">
                    {showKeys && <span className="key-text">r</span>}
                    <div className="black" data-code="53" data-key="Gb3">
                        {showKeys && <span className="key-text">5</span>}
                    </div>
                </div>
                <div className="white" data-key="G3" data-code="84">
                    {showKeys && <span className="key-text">t</span>}
                    <div className="black" data-code="54" data-key="Ab3">
                        {showKeys && <span className="key-text">6</span>}
                    </div>
                </div>
                <div className="white" data-key="A3" data-code="89">
                    {showKeys && <span className="key-text">y</span>}
                    <div className="black" data-code="55" data-key="Bb3">
                        {showKeys && <span className="key-text">7</span>}
                    </div>
                </div>
                <div className="white" data-key="B3" data-code="85">
                    {showKeys && <span className="key-text">u</span>}
                </div>
                <div className="white" data-key="C4" data-code="73">
                    {showKeys && <span className="key-text">i</span>}
                    <div className="black" data-code="57" data-key="Db4">
                        {showKeys && <span className="key-text">9</span>}
                    </div>
                </div>
                <div className="white" data-key="D4" data-code="79">
                    {showKeys && <span className="key-text">o</span>}
                    <div className="black" data-code="48" data-key="Eb4">
                        {showKeys && <span className="key-text">0</span>}
                    </div>
                </div>
                <div className="white" data-key="E4" data-code="80">
                    {showKeys && <span className="key-text">p</span>}
                </div>
                <div className="white" data-key="F4" data-code="90">
                    {showKeys && <span className="key-text">z</span>}
                    <div className="black" data-code="83" data-key="Gb4">
                        {showKeys && <span className="key-text">s</span>}
                    </div>
                </div>
                <div className="white" data-key="G4" data-code="88">
                    {showKeys && <span className="key-text">x</span>}
                    <div className="black" data-code="68" data-key="Ab4">
                        {showKeys && <span className="key-text">d</span>}
                    </div>
                </div>
                <div className="white" data-key="A4" data-code="67">
                    {showKeys && <span className="key-text">c</span>}
                    <div className="black" data-code="70" data-key="Bb4">
                        {showKeys && <span className="key-text">f</span>}
                    </div>
                </div>
                <div className="white" data-key="B4" data-code="86">
                    {showKeys && <span className="key-text">v</span>}
                </div>
                <div className="white" data-key="C5" data-code="66">
                    {showKeys && <span className="key-text">b</span>}
                </div>
                {/* <audio></audio> */}
            </ul>
            <Controls getControlData={getControlData} />
            { touchedKeys.length > 0 && <KeyPrint notes={touchedKeys} pattern={formula} /> }
            <Similarity playPattern={playPattern} />
            <Footer />
        </>
    );

    function getControlData(data) {
        const pattern = getScalePattern(data);
        setFormula(pattern)
        playScale(pattern, data.variation, data.major)
    }

    function playPattern(pattern, variation) {
        playScale(pattern, variation, 0)
    }

    async function playScale(pattern, variation, major) {
        if(!pattern || isPlaying) {
            return;
        }
        setIsPlaying(true)
        let keys = Array.from(document.querySelectorAll('.set div'));
        const start = mapVariationToStart(variation) + parseInt(major);
        // GET KEYS
        keys = getKeysTobePlayed(keys, pattern, start)
        // DISPLAY KEYS
        setTouchedKeys(keys)
        // PLAY FORWARD
        await playScaleForward(keys)
        // PLAY BACKWARD
        await playScaleBackward(keys)
        setIsPlaying(false)
    }
}

export default Piano
