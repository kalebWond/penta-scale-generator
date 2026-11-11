import { useEffect, useState } from 'react'

// State that survives its component unmounting, for the rest of the visit (not a reload).
// A feature unmounts when you go to another one; this keeps what you'd picked for when you come back.
const store = new Map()

export function useStickyState(key, initial) {
    const [value, setValue] = useState(() => (store.has(key) ? store.get(key) : initial))
    useEffect(() => { store.set(key, value) }, [key, value])
    return [value, setValue]
}
