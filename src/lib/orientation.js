// Best-effort landscape on phones. Browsers only allow this from a user gesture, and only some of them:
//  - Android Chrome: fullscreen + screen.orientation.lock works (even with auto-rotate off).
//  - iOS Safari: no lock and no fullscreen on iPhone; the CSS rotation fallback in App.css covers it.
export const isTouchDevice = () =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export async function enterLandscape() {
    if (!isTouchDevice()) return
    const el = document.documentElement
    try {
        if (!document.fullscreenElement && el.requestFullscreen) {
            await el.requestFullscreen({ navigationUI: 'hide' })
        }
    } catch (e) { /* denied or unsupported */ }
    try {
        if (window.screen.orientation && window.screen.orientation.lock) {
            await window.screen.orientation.lock('landscape')
        }
    } catch (e) { /* not supported / not allowed outside fullscreen */ }
}
