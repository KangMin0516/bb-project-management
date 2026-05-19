import * as React from "react"

// Exposes the SheetContent DOM node so nested overlays (Popover/Dropdown) can
// portal *inside* the Sheet — required so the Sheet's scroll-lock whitelists
// their wheel events. See PM-27.
export const SheetPortalContext = React.createContext<HTMLElement | null>(null)

export const useSheetPortalContainer = () => React.useContext(SheetPortalContext)
