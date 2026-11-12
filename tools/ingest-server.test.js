// @vitest-environment node
import { linksIn, videoIdIn } from './ingest-server.js'

describe('links pasted into "Add songs"', () => {
    test('every common YouTube link gives its video id', () => {
        expect(videoIdIn('https://www.youtube.com/watch?v=RuHbBro5u2g')).toBe('RuHbBro5u2g')
        expect(videoIdIn('https://youtu.be/KwX1f2gYKZ4?si=abc')).toBe('KwX1f2gYKZ4')
        expect(videoIdIn('https://m.youtube.com/watch?feature=share&v=1yBzIt_z8oY&t=30')).toBe('1yBzIt_z8oY')
        expect(videoIdIn('https://youtube.com/shorts/abcdefghij1')).toBe('abcdefghij1')
        expect(videoIdIn('RuHbBro5u2g')).toBe('RuHbBro5u2g')
    })

    test('anything else is not a link', () => {
        expect(videoIdIn('https://example.com/watch?v=RuHbBro5u2g')).toBeNull()
        expect(videoIdIn('beautifully')).toBeNull()        // an 11-letter word is not an id
    })

    test('a paste of several links gives each video once, in order', () => {
        const text = 'two: https://youtu.be/1yBzIt_z8oY\nhttps://www.youtube.com/watch?v=KwX1f2gYKZ4 '
            + 'and again https://www.youtube.com/watch?v=1yBzIt_z8oY&t=3'
        expect(linksIn(text)).toEqual(['1yBzIt_z8oY', 'KwX1f2gYKZ4'])
        expect(linksIn('no links here')).toEqual([])
    })

    test('links separated by commas, or glued together, are each found', () => {
        expect(linksIn('https://youtu.be/1yBzIt_z8oY,https://youtu.be/KwX1f2gYKZ4, RuHbBro5u2g'))
            .toEqual(['1yBzIt_z8oY', 'KwX1f2gYKZ4', 'RuHbBro5u2g'])
        // a list pasted into a one-line box loses its line breaks
        expect(linksIn('https://youtu.be/1yBzIt_z8oYhttps://www.youtube.com/watch?v=KwX1f2gYKZ4'))
            .toEqual(['1yBzIt_z8oY', 'KwX1f2gYKZ4'])
    })
})
