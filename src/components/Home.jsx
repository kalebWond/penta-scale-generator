import { CARDS } from '../features/registry'
import { BackIcon, FeatureIcon } from './icons'

// The launcher: one card per feature. The tap on a card is also what lets the browser start
// audio, so opening the app here needs no separate "tap to start".
function Home({ loaded, total, done, error, onOpen }) {
    return (
        <main className="home">
            <h1 className="brand brand--big">Penta<span>Scales</span></h1>
            <p className="home__tag">Learn the Ethiopian pentatonic scales and their modes</p>

            <nav className="home__cards" aria-label="Features">
                {CARDS.map(f => (
                    <button key={f.id} type="button" className="home__card" onClick={() => onOpen(f.id)}>
                        <span className="home__icon"><FeatureIcon name={f.card.icon} /></span>
                        <span className="home__label">{f.card.label}</span>
                        <span className="home__desc">{f.card.description}</span>
                    </button>
                ))}
            </nav>

            {error
                ? <p className="gate__status gate__status--error">{error}</p>
                : <p className="gate__status">
                    {!done ? `Loading sounds ${loaded}/${total}`
                        : loaded < total ? `${total - loaded} sounds failed to load` : 'Sounds ready'}
                    <span className={`gate__bar ${done ? 'is-done' : ''}`} aria-hidden={done}>
                        <i style={{ width: `${(loaded / total) * 100}%` }} />
                    </span>
                </p>}
            <p className="gate__credit">Programmed by Kaleb Wondwossen Tsegaye &copy; 2021</p>
        </main>
    )
}

// Inside a feature, the brand plate in the panel's corner takes you back here.
export function HomeButton({ onHome }) {
    return (
        <button type="button" className="brand brand--home" onClick={onHome} aria-label="Home" title="Home">
            <BackIcon />
            <span className="brand--home__name">Penta<span>Scales</span></span>
        </button>
    )
}

export default Home
