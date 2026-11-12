// @vitest-environment node
import { linksIn, videoIdIn } from './ingest-server.js'

describe('links pasted into "Add songs"', () => {
    test('every common YouTube link gives its video id', () => {
        expect(videoIdIn('https://www.youtube.com/watch?v=RuHbBro5u2g')).toBe('RuHbBro5u2g')
        expect(videoIdIn('https://youtu.be/H-Y4BZpOkSw?si=abc')).toBe('H-Y4BZpOkSw')
        expect(videoIdIn('https://m.youtube.com/watch?feature=share&v=CocA4mTVKw4&t=30')).toBe('CocA4mTVKw4')
        expect(videoIdIn('https://youtube.com/shorts/abcdefghij1')).toBe('abcdefghij1')
        expect(videoIdIn('RuHbBro5u2g')).toBe('RuHbBro5u2g')
    })

    test('anything else is not a link', () => {
        expect(videoIdIn('https://example.com/watch?v=RuHbBro5u2g')).toBeNull()
        expect(videoIdIn('beautifully')).toBeNull()        // an 11-letter word is not an id
    })

    test('a paste of several links gives each video once, in order', () => {
        const text = 'two: https://youtu.be/CocA4mTVKw4\nhttps://www.youtube.com/watch?v=H-Y4BZpOkSw '
            + 'and again https://www.youtube.com/watch?v=CocA4mTVKw4&t=3'
        expect(linksIn(text)).toEqual(['CocA4mTVKw4', 'H-Y4BZpOkSw'])
        expect(linksIn('no links here')).toEqual([])
    })

    test('links separated by commas, or glued together, are each found', () => {
        expect(linksIn('https://youtu.be/CocA4mTVKw4,https://youtu.be/H-Y4BZpOkSw, RuHbBro5u2g'))
            .toEqual(['CocA4mTVKw4', 'H-Y4BZpOkSw', 'RuHbBro5u2g'])
        // a list pasted into a one-line box loses its line breaks
        expect(linksIn('https://youtu.be/CocA4mTVKw4https://www.youtube.com/watch?v=H-Y4BZpOkSw'))
            .toEqual(['CocA4mTVKw4', 'H-Y4BZpOkSw'])
    })
})
