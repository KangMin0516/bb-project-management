import type { ReactNode } from 'react'

interface SettingsSectionProps {
  title: ReactNode
  /** Tailwind class to override the wrapper (e.g., red Danger Zone border). */
  className?: string
  id?: string
  children: ReactNode
}

/** Shared styling for a settings section card so each section file stays small. */
export default function SettingsSection({ title, className, id, children }: SettingsSectionProps) {
  return (
    <section
      id={id}
      className={
        className ??
        'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5'
      }
    >
      <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
      {children}
    </section>
  )
}
