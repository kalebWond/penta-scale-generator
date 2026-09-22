const makeParam = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
})

let sources
class FakeAudioContext {
    constructor() {
        this.currentTime = 1
        this.state = 'suspended'
        this.destination = {}
    }
    createGain() { return { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn() } }
    createDynamicsCompressor() { return { connect: vi.fn() } }
    createBufferSource() {
        const s = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }
        sources.push(s)
        return s
    }
    decodeAudioData(data) { return Promise.resolve({ decoded: data }) }
    async resume() { this.state = 'running' }
}

let engine
beforeEach(async () => {
    sources = []
    window.AudioContext = FakeAudioContext
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }))
    // resetModules + dynamic import gives each test a fresh engine with empty buffers
    vi.resetModules()
    engine = await import('./engine')
})

test('resume unlocks the context', async () => {
    expect(await engine.resume()).toBe(true)
})

test('loadSamples fetches and decodes all 25 samples, reporting each', async () => {
    const seen = []
    await engine.loadSamples(name => seen.push(name))
    expect(seen).toHaveLength(25)
    expect(seen[0]).toBe('C4')      // middle octave first
    expect(engine.isLoaded('C3')).toBe(true)
})

test('a failing sample is reported and does not block the others', async () => {
    global.fetch = vi.fn(url => url.includes('Db3')
        ? Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' })
        : Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }))
    const errors = []
    const seen = []
    await engine.loadSamples(n => seen.push(n), (n) => errors.push(n))
    expect(errors).toEqual(['Db3'])
    expect(seen).toHaveLength(24)
    expect(engine.noteOn('Db3')).toBe(false)
})

test('noteOn schedules on the audio clock; unknown/unloaded notes are ignored', async () => {
    await engine.loadSamples()
    expect(engine.noteOn('C3', 3.5)).toBe(true)
    expect(sources[0].start).toHaveBeenCalledWith(3.5)
    expect(engine.noteOn('H9')).toBe(false)
})

test('retriggering a note releases the previous voice', async () => {
    await engine.loadSamples()
    engine.noteOn('C3', 1.5)
    engine.noteOn('C3', 2)
    expect(sources).toHaveLength(2)
    expect(sources[0].stop).toHaveBeenCalled()
})

test('stopAll cancels voices that have not started yet, and fades those sounding', async () => {
    await engine.loadSamples()
    engine.noteOn('C3', 5)     // future
    engine.noteOn('D3', 1)     // starts now
    engine.noteOn('C3', 9)     // same key again, later
    engine.stopAll()
    expect(sources[0].stop).toHaveBeenCalledWith(1)   // never started: cancelled at "now"
    expect(sources[2].stop).toHaveBeenCalledWith(1)
    expect(sources[1].stop).toHaveBeenCalled()        // fading out
})
