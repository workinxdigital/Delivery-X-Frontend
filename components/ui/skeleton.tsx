import { cn } from '@/lib/utils'

/** Loading is a skeleton in place, never a centred spinner (DESIGN.md). */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-wash animate-pulse rounded-sm', className)}
      {...props}
    />
  )
}

export { Skeleton }
