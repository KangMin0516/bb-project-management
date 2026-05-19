import * as React from "react"

/**
 * Overlay portal container — the DOM node of the nearest open Sheet or
 * Dialog. Nested overlays (Popover, Select, Combobox) read this and
 * portal *inside* the overlay so that:
 *
 *   1. `react-remove-scroll`'s wheel guard treats them as whitelisted
 *      scroll containers (otherwise wheel-scroll on a sub-popover is
 *      silently preventDefault'd — see PM-27, PM-42).
 *   2. They get z-stacked above the parent overlay automatically.
 *
 * The context name is historical (originally just Sheet); the
 * `useSheetPortalContainer` export is kept for backward compatibility
 * with the PM-27 fix's callers. Prefer `useOverlayPortalContainer`
 * for new code — same value, clearer intent.
 */
export const SheetPortalContext = React.createContext<HTMLElement | null>(null)

export const useSheetPortalContainer = () => React.useContext(SheetPortalContext)
export const useOverlayPortalContainer = useSheetPortalContainer
