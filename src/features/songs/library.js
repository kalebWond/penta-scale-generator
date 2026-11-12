import { songScale } from './timeline'

// The song library page: search, picks, thumbnails. Works on public/songs/index.json entries:
//   { videoId, title, duration, key, tonic, mode, bpm, analyzedAt, pick }

// YouTube serves every video's thumbnails at a fixed address; no API key needed.
export const thumbnailUrl = (videoId) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`

// Lower case, accents folded, so "Tizita" finds "tizita" and "é" finds "e". Ethiopic is unchanged.
const fold = (text) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

// What a search looks through: the title (artist and song name are in it) and the scale,
// so "bati" finds every song in Bati.
const searchText = (song) => fold(`${song.title ?? ''} ${songScale(song)?.label ?? ''} ${song.key ?? ''}`)

// Songs containing every word of the query, in library order.
export function searchSongs(songs, query) {
    const words = fold(query).split(/\s+/).filter(Boolean)
    if (!words.length) return songs
    return songs.filter(song => {
        const text = searchText(song)
        return words.every(w => text.includes(w))
    })
}

// Songs marked as picks ("pick": true in the song's JSON), or else the newest ones.
export function recommendedSongs(songs, count = 8) {
    const picks = songs.filter(s => s.pick)
    if (picks.length) return picks.slice(0, count)
    return [...songs]
        .sort((a, b) => (b.analyzedAt ?? '').localeCompare(a.analyzedAt ?? ''))
        .slice(0, count)
}
