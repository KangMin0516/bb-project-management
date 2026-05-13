import { cn } from '@/shared/lib/utils'
import { METHOD_COLORS } from '@/features/api-docs/lib'

export default function MethodBadge({ method }: { method: string }) {
  const colors = METHOD_COLORS[method] || METHOD_COLORS.GET
  return (
    <span className={cn('inline-flex w-16 items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold uppercase', colors.bg, colors.text)}>
      {method}
    </span>
  )
}
