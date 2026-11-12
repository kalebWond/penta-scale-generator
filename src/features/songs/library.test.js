import { recommendedSongs, searchSongs, thumbnailUrl } from './library'

const SONGS = [
    { videoId: 'CocA4mTVKw4', title: 'ይኸው ልቤን YIHEW LIBEN ካሮል ፈቃዱ CAROL FEKADU', tonic: 'E', mode: 'minor', key: 'Em', analyzedAt: '2026-11-11' },
    { videoId: 'bbbbbbbbbbb', title: 'Amlak Tewodros', tonic: 'G', mode: 'major', key: 'G', analyzedAt: '2026-11-12' },
    { videoId: 'ccccccccccc', title: 'Égziabhér yimesgen', tonic: 'A', mode: 'minor', key: 'Am' },
]
const ids = (songs) => songs.map(s => s.videoId)

describe('search', () => {
    test('an empty query is the whole library', () => {
        expect(searchSongs(SONGS, '  ')).toBe(SONGS)
    })

    test('every word must match, in any case', () => {
        expect(ids(searchSongs(SONGS, 'carol liben'))).toEqual(['CocA4mTVKw4'])
        expect(ids(searchSongs(SONGS, 'CAROL tewodros'))).toEqual([])
    })

    test('Ethiopic titles are searchable', () => {
        expect(ids(searchSongs(SONGS, 'ልቤን'))).toEqual(['CocA4mTVKw4'])
    })

    test('accents are folded', () => {
        expect(ids(searchSongs(SONGS, 'egziabher'))).toEqual(['ccccccccccc'])
    })

    test('the scale is searchable too', () => {
        expect(ids(searchSongs(SONGS, 'bati'))).toEqual(['CocA4mTVKw4', 'ccccccccccc'])
        expect(ids(searchSongs(SONGS, 'bati carol'))).toEqual(['CocA4mTVKw4'])
        expect(ids(searchSongs(SONGS, 'tizita'))).toEqual(['bbbbbbbbbbb'])
    })
})

describe('recommended', () => {
    test('picks first, when there are any', () => {
        const songs = SONGS.map(s => (s.videoId === 'ccccccccccc' ? { ...s, pick: true } : s))
        expect(ids(recommendedSongs(songs))).toEqual(['ccccccccccc'])
    })

    test('otherwise the newest, undated last', () => {
        expect(ids(recommendedSongs(SONGS))).toEqual(['bbbbbbbbbbb', 'CocA4mTVKw4', 'ccccccccccc'])
        expect(recommendedSongs(SONGS, 1)).toHaveLength(1)
    })
})

test('thumbnails need no API key', () => {
    expect(thumbnailUrl('CocA4mTVKw4')).toBe('https://i.ytimg.com/vi/CocA4mTVKw4/mqdefault.jpg')
})
