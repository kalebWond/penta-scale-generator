import Segmented from './Segmented'

export const SPEEDS = [
    { value: 0.75, label: '0.75×' },
    { value: 1, label: '1×' },
    { value: 1.5, label: '1.5×' },
]

// How fast scale runs play; shared by the scales and the quiz.
function SpeedField({ speed, onSpeed }) {
    return (
        <div className="field">
            <span className="field__label">Speed</span>
            <Segmented label="Speed" options={SPEEDS} value={speed} onChange={onSpeed} />
        </div>
    )
}

export default SpeedField
