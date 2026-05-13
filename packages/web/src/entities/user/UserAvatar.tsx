import { cn } from '@/shared/lib/utils'

type UserLike = { name: string; avatar?: string | null }

const SIZE_CLASSES = {
  xs: 'h-4 w-4 text-[8px]',
  sm: 'h-5 w-5 text-[10px]',
  md: 'h-6 w-6 text-xs',
  lg: 'h-8 w-8 text-sm',
} as const

const VARIANT_BG = {
  primary: 'bg-primary-100 text-primary-700',
  purple: 'bg-purple-100 text-purple-700',
  gray: 'bg-gray-100 dark:bg-gray-600 text-gray-400',
} as const

interface UserAvatarProps {
  user: UserLike | null
  size?: keyof typeof SIZE_CLASSES
  /** Color of the initials-fallback chip. Default 'primary'. */
  variant?: keyof typeof VARIANT_BG
  className?: string
}

/**
 * Renders the user's avatar image when present, else their initial inside a
 * coloured circle. Falls back to '?' when `user` is null (e.g. unassigned).
 */
export default function UserAvatar({ user, size = 'sm', variant = 'primary', className }: UserAvatarProps) {
  const sizeClass = SIZE_CLASSES[size]

  if (!user) {
    return (
      <span className={cn('flex items-center justify-center rounded-full', sizeClass, VARIANT_BG.gray, className)}>
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
    <span className={cn('flex items-center justify-center rounded-full font-medium', sizeClass, VARIANT_BG[variant], className)}>
      {user.name.charAt(0).toUpperCase()}
    </span>
  )
}
