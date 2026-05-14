import type { ReactNode } from 'react'

/** Lightweight hover tooltip — visible on hover via the `group/tip` modifier. */
export default function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="group/tip relative inline-flex">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 opacity-0 transition-opacity group-hover/tip:opacity-100">
        <div className="whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg dark:shadow-gray-900/50">
          {text}
        </div>
        <div className="mx-auto h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-gray-900" />
      </div>
    </div>
  )
}
