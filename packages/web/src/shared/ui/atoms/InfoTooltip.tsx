import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface TooltipLine {
  lang: string
  text: string
}

interface InfoTooltipProps {
  lines: TooltipLine[]
  className?: string
  iconClassName?: string
}

export default function InfoTooltip({ lines, className, iconClassName }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<'bottom' | 'top'>('bottom')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setPosition(spaceBelow < 180 ? 'top' : 'bottom')
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        tooltipRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium transition-colors',
          'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:text-gray-500',
          iconClassName,
        )}
      >
        i
      </button>

      {open && (
        <div
          ref={tooltipRef}
          className={cn(
            'absolute z-50 w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg dark:shadow-gray-900/50',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            position === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
            'left-1/2 -translate-x-1/2',
          )}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.lang} className="flex gap-2">
                <span className="mt-px shrink-0 rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 text-[9px] font-bold uppercase leading-none text-gray-500 dark:text-gray-400">
                  {line.lang}
                </span>
                <span className="text-xs leading-relaxed text-gray-600 dark:text-gray-500">
                  {line.text}
                </span>
              </div>
            ))}
          </div>
          {/* Arrow */}
          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2',
              position === 'bottom'
                ? '-top-[5px] border-b-white border-l-transparent border-r-transparent border-t-transparent border-[5px] border-b-[5px] border-t-0 drop-shadow-[0_-1px_0_rgb(229,231,235)]'
                : '-bottom-[5px] border-t-white border-l-transparent border-r-transparent border-b-transparent border-[5px] border-t-[5px] border-b-0 drop-shadow-[0_1px_0_rgb(229,231,235)]',
            )}
          />
        </div>
      )}
    </span>
  )
}
