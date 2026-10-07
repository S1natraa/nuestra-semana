import { LoaderCircle } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/lib/browser'

type Variant = 'primary' | 'secondary' | 'ghost' | 'cream' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const base =
  'focus-ring relative inline-flex select-none items-center justify-center gap-2 rounded-full font-bold tracking-tight ' +
  'transition-[transform,background-color,filter,opacity,box-shadow] duration-150 active:scale-[0.97] ' +
  'disabled:pointer-events-none disabled:opacity-45'

const variants: Record<Variant, string> = {
  primary:
    'bg-linear-to-r from-blush-300 to-lilac-300 text-ink shadow-[0_12px_32px_-14px_rgb(255_148_180/0.75)] hover:brightness-105',
  secondary: 'bg-navy-700 text-cream-50 hover:bg-navy-600',
  ghost: 'text-navy-200 hover:bg-white/6 hover:text-cream-50',
  cream: 'bg-cream-50 text-ink shadow-soft hover:bg-white',
  danger: 'bg-coral-400/15 text-coral-300 hover:bg-coral-400/25',
  outline: 'border border-white/15 text-cream-50 hover:bg-white/6',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-14 px-7 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], block && 'w-full', className)}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

export interface ButtonLinkProps extends LinkProps {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  block?: boolean
}

export function ButtonLink({ variant = 'primary', size = 'md', icon, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], block && 'w-full', className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}
