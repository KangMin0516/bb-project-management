import { useEffect, useState } from 'react'

/**
 * Returns `value` debounced by `delayMs`. Re-renders only after the user
 * stops changing the source value — perfect for search inputs that drive
 * network requests.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
