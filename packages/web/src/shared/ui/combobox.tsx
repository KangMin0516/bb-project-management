import { useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command'

export interface ComboboxOption {
  value: string
  /** Text shown in the trigger when nothing else is provided. */
  label: string
  /** Text fed to cmdk for fuzzy matching (defaults to `label`). */
  searchValue?: string
  /** Optional row renderer for the dropdown list. Falls back to `label`. */
  render?: ReactNode
  /** Optional renderer for the *trigger* when this option is selected.
   *  Falls back to `render`, then `label`. Use this when the list row is
   *  rich (e.g. avatar + name + email stacked) but the trigger should
   *  stay compact on a single 36px-tall input row. */
  triggerRender?: ReactNode
}

interface ComboboxProps {
  value: string
  onChange: (next: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  /** Width class for the trigger + popover; defaults full-width of parent. */
  className?: string
  /** Disable the trigger. */
  disabled?: boolean
  /** Open the popover automatically on mount (mirrors `defaultOpen` on Radix Select). */
  defaultOpen?: boolean
  /** Notified whenever the popover open state changes. */
  onOpenChange?: (open: boolean) => void
}

export default function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  className,
  disabled,
  defaultOpen = false,
  onOpenChange,
}: ComboboxProps) {
  const [open, setOpen] = useState(defaultOpen)
  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-sm text-gray-900 dark:text-gray-100 ring-offset-background focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('truncate', !selected && 'text-gray-400 dark:text-gray-500')}>
            {selected ? selected.triggerRender ?? selected.render ?? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.searchValue ?? opt.label}
                  onSelect={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'h-4 w-4',
                      value === opt.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {opt.render ?? opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
