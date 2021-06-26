export const scales = [
    { value: 'TIZITA-1', label: 'Tizita major' },
    { value: 'TIZITA-2', label: 'Tizita minor' },
    { value: 'AMBASEL-1', label: 'Ambasel major' },
    { value: 'AMBASEL-2', label: 'Ambasel minor' },
    { value: 'BATI-1', label: 'Bati major' },
    { value: 'BATI-2', label: 'Bati minor' },
    { value: 'ANCHOYE', label: 'Anchi hoye lene' },
]
export const variations = [
    { value: '0', label: '1st' },
    { value: '1', label: '2nd' },
    { value: '3', label: '5th' },
    { value: '4', label: '6th' },
]

export const majors = [
    { value: '0', label: 'C' },
    { value: '1', label: 'C#' },
    { value: '2', label: 'D' },
    { value: '3', label: 'D#' },
    { value: '4', label: 'E' },
    { value: '5', label: 'F' },
    { value: '6', label: 'F#' },
    { value: '7', label: 'G' },
    { value: '8', label: 'G#' },
    { value: '9', label: 'A' },
    { value: '10', label: 'A#' },
    { value: '11', label: 'B' },
]

export const getScalePattern = ({scale, variation}) => {
    let pattern;
    switch (scale) {
        case "TIZITA-1":
            pattern = [1, 1, 1.5, 1, 1.5]
            return [...pattern.slice(variation), ...pattern.slice(0, variation)]
        case "TIZITA-2":
            pattern = [1, 0.5, 2, 0.5, 2]
            return [...pattern.slice(variation), ...pattern.slice(0, variation)]
        case "AMBASEL-1":
            pattern = [1, 1.5, 1, 1, 1.5]
            return [...pattern.slice(variation), ...pattern.slice(0, variation)]
        case "AMBASEL-2":
            pattern = [0.5, 2, 1, 0.5, 2]
            return [...pattern.slice(variation), ...pattern.slice(0, variation)]
        case "BATI-1":
            pattern = [2, 0.5, 1, 2, 0.5]
            return [...pattern.slice(variation), ...pattern.slice(0, variation)]
        case "BATI-2":
            pattern = [1.5, 1, 1, 1.5, 1]
            return [...pattern.slice(variation), ...pattern.slice(0, variation)]
        case "ANCHOYE":
            pattern = [0.5, 2, 0.5, 1.5, 1.5]
            return [...pattern.slice(variation), ...pattern.slice(0, variation)]
        default:
            break;
    }
}

export const removeTransition = (e) => {
    if (e.propertyName !== 'box-shadow') return;
    e.target.classList.remove(`${e.target.classList[0]}-active`)
}

export const playSoundByKeyboard = (e) => {
    if (e.repeat) {
        return;
    }
    const note = document.querySelector(`div[data-code="${e.keyCode}"]`);
    if (!note) {
        return;
    }
    const audio = document.querySelector('audio')
    // reset the audio src tag
    audio.src = "assets/sounds/";
    const newAudio = audio.cloneNode()
    note.classList.add(`${note.classList[0]}-active`)
    const { key } = note.dataset;
    newAudio.src = `${newAudio.src}${key}.ogg`;
    newAudio.currentTime = 0;
    newAudio.play();
}

export const playSound = (e) => {
    const audio = document.querySelector('audio')
    // reset the audio src tag
    audio.src = "assets/sounds/";
    const newAudio = audio.cloneNode()
    const { key } = e.target.dataset;
    if (!key) {
        return;
    }
    e.target.classList.add(`${e.target.classList[0]}-active`)
    newAudio.src = `${newAudio.src}${key}.ogg`;
    newAudio.currentTime = 0;
    newAudio.play();
}

export const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const playKey = (note) => {
    if(!note) {
        return;
    }
    const audio = document.querySelector('audio')
    // reset the audio src tag
    audio.src = "assets/sounds/";
    const newAudio = audio.cloneNode()
    const { key } = note.dataset;
    if (!key) {
        return;
    }
    note.classList.add(`${note.classList[0]}-active`)
    newAudio.src = `${newAudio.src}${key}.ogg`;
    newAudio.currentTime = 0;
    newAudio.play();
}

export const mapVariationToStart = (variation) => {
    const map = { 0: 0, 1: 2, 3: 7, 4: 9 }
    return map[variation]
}

export const getKeysTobePlayed = (notes, pattern, startIndex) => {
    if(!notes || notes.length === 0) {
        return null;
    }
    const keys = [notes[startIndex]]
    let prevSum = startIndex;
    pattern.forEach(val => {
        const note = notes[(val*2) + (prevSum)]
        keys.push(note)
        prevSum += val*2;
    });
    return keys;
}

export const playScaleForward = async (keys) => {
    if(!keys || keys.length === 0) {
        return null;
    }
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if(i === 2) {
            await sleep(400)
        } else if(i === 3) {
            await sleep(800)
        } else if(i === 4) {
            await sleep(450)
        } else if(i === 5) {
            await sleep(600)
        } else {
            await sleep(300)
        }
        playKey(key)
    }
}

export const playScaleBackward = async (keys) => {
    if(!keys || keys.length === 0) {
        return null;
    }
    let newKeys = [...keys];
    newKeys = newKeys.reverse()
    for (let i = 0; i < newKeys.length; i++) {
        const key = newKeys[i];
        if(i === 0) {
            await sleep(800)
        } else if(i === 3) {
            await sleep(600)
        } else if(i === 5) {
            await sleep(450)
        } else {
            await sleep(500)
        }
        playKey(key)
    }
}

export const computePatterns = () => {
    const scaleTable = [];
    const tableValue = []
    scales.forEach(sc => {
        let scale = sc.value;
        variations.forEach(vr => {
            const variation = vr.value;
            const result = getScalePattern({scale, variation})
            scaleTable.push([sc.label, vr.label])
            tableValue.push(JSON.stringify(result))
        })
    })
    const obj = {}
    tableValue.forEach((item, i) => {
        if(obj[item]) {
            obj[item] = [ ...obj[item], scaleTable[i] ]
        } else {
            obj[item] = [scaleTable[i]]
        }
    })
    Object.keys(obj).forEach(key => {
        if(obj[key].length < 2) {
            delete obj[key]
        }
    })
    return obj
}
