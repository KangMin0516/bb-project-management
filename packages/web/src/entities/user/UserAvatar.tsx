import { cn } from '@/shared/lib/utils'
import { stringToHslColor } from '@/shared/lib/color'

type UserLike = { name: string; avatar?: string | null }

const SIZE_CLASSES = {
  xs: 'h-4 w-4 text-[8px]',
  sm: 'h-5 w-5 text-[10px]',
  md: 'h-6 w-6 text-xs',
  lg: 'h-8 w-8 text-sm',
} as const

interface UserAvatarProps {
  user: UserLike | null
  size?: keyof typeof SIZE_CLASSES
  className?: string
}

/**
 * Renders the user's avatar image when present, else a coloured initial
 * chip whose hue is derived from the user's name (so the same person
 * shows the same colour everywhere — board cards, activity, metadata,
 * @-mentions). Falls back to a neutral '?' chip when `user` is null.
 */
export default function UserAvatar({ user, size = 'sm', className }: UserAvatarProps) {
  const sizeClass = SIZE_CLASSES[size]

  if (!user) {
    return (
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-600 text-gray-400',
          sizeClass,
          className,
        )}
      >
        ?
      </span>
    )
  }

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        className={cn('rounded-full object-cover', sizeClass, className)}
      />
    )
  }

  return (
    <span
      className={cn('flex items-center justify-center rounded-full font-medium', sizeClass, className)}
      style={{
        // bg uses the function's defaults so identities stay distinguishable
        // at a glance; text uses the same hue at low lightness so contrast
        // is preserved across every hue (pure white fails on yellow / cyan).
        backgroundColor: stringToHslColor(user.name),
        color: stringToHslColor(user.name, 70, 20),
      }}
    >
      {user.name.charAt(0).toUpperCase()}
    </span>
  )
}
