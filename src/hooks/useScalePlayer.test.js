import { buildSchedule } from './useScalePlayer'

describe('buildSchedule', () => {
    test('goes up then back down, top note repeated, 12 events for a 6-note run', () => {
        const events = buildSchedule(6)
        expect(events.map(e => e.step)).toEqual([0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0])
    })

    test('first note is immediate, times strictly increase, and the top-note pause is the longest', () => {
        const events = buildSchedule(6)
        expect(events[0].time).toBe(0)
        const times = events.map(e => e.time)
        expect(times.every((t, i) => i === 0 || t > times[i - 1])).toBe(true)
        expect(events[6].time - events[5].time).toBeCloseTo(0.8)
    })

    test('speed scales every gap', () => {
        const slow = buildSchedule(6, 0.5)
        const normal = buildSchedule(6, 1)
        expect(slow[11].time).toBeCloseTo(normal[11].time * 2)
    })
})
