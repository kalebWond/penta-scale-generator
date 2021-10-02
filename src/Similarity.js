import { useEffect, useState } from "react"
import { computePatterns } from "./_helpers"

function Similarity({playPattern}) {
    const [rows, setRows] = useState()
    const [patterns, setPatterns] = useState()
    const [scales, setScales] = useState()

    useEffect(() => {
        if(rows) {
            const pats = []
            const scs = []
            Object.entries(rows).forEach(([key, value]) => {
                scs.push(value);
                key = key.slice(1, -1).split(',').join('Tone,  ').concat('Tone');
                pats.push(key);
            })
            setPatterns(pats); setScales(scs)
        }
    }, [rows])
    return (
        <section className="similarity">
            { !rows && (
                <button onClick={computeSimilarity} className="btn btn--main">Find Similar Scales</button>
            ) }
            { rows && (
                <div className="data">
                    {
                        scales && scales.map((group, i) => (
                            <div key={patterns[i]} className="rows">
                                { group.map((item, j) => (
                                    <div key={patterns[i]+j} className="item">
                                        <div onClick={() => playNote(i, item[1])} className="img-container">
                                            <img src="assets/img/play.png" alt="" className="img"/>
                                        </div>
                                        <div>
                                            <p className="name">{item.join(' ')}</p>
                                            <p className="name name--small">{patterns[i]}</p>
                                        </div>
                                    </div>
                                )) }
                            </div>
                        ))
                    }
                </div>
            )}
        </section>
    )

    function computeSimilarity() {
        const data = computePatterns();
        setRows(data)
    }

    function playNote(i, vrn) {
        const variation = mapStrToVariation(vrn)
        const pattern = Object.keys(rows)[i]
        playPattern(JSON.parse(pattern), variation)
    }

    function mapStrToVariation(str) {
        switch (str) {
            case '1st':
                return 0
            case '2nd':
                return 1
            case '5th':
                return 3
            case '6th':
                return 4
            default:
                return 0
        }
    }
}

export default Similarity
