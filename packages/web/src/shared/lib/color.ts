/**
 * Deterministic per-string colour. Hashes the input via the classic
 * `(hash << 5) - hash + charCode` rolling hash and emits an HSL string,
 * so the same name always yields the same hue — used for initials-only
 * avatar chips, label fallbacks, and any other surface that needs a
 * stable colour per identity.
 *
 * Lightness 60 + saturation 55 gives a mid-tone background that reads
 * across light and dark themes; callers that need a contrasting text
 * colour can call again with a lower lightness on the same string.
 */
export function stringToHslColor(str: string, s = 55, l = 60): string {
  let hash = 0
  const len = str?.length ?? 0
  for (let i = 0; i < len; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${hash % 360}, ${s}%, ${l}%)`
}
