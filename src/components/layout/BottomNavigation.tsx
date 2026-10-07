import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/browser'
import type { NavItem } from './navigation'

export function BottomNavigation({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-safe lg:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch rounded-[26px] border border-white/8 bg-navy-850/92 p-1.5 shadow-card backdrop-blur-xl">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              aria-label={item.locked ? `${item.label} (bloqueada: ${item.hint ?? ''})` : item.label}
              className={({ isActive }) =>
                cn(
                  'focus-ring relative flex h-[58px] flex-col items-center justify-center gap-1 rounded-[20px] text-[11px] font-bold transition-colors',
                  isActive ? 'text-ink' : 'text-navy-300 active:text-cream-50',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="bottom-active"
                      className="absolute inset-0 rounded-[20px] bg-cream-50"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">
                    <item.icon className="size-[22px]" aria-hidden />
                    {item.locked && !isActive && (
                      <Lock className="absolute -right-2 -bottom-1 size-3 rounded-full bg-navy-850 p-[1px] text-navy-300" aria-hidden />
                    )}
                    {item.attention && (
                      <span className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-blush-400 ring-2 ring-navy-850" aria-hidden />
                    )}
                  </span>
                  <span className="relative">{item.shortLabel}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
