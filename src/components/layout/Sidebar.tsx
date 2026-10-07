import { motion } from 'framer-motion'
import { Lock, Volume2, VolumeX } from 'lucide-react'
import { NavLink } from 'react-router'
import { Avatar } from '@/components/avatar/Avatar'
import { formatWeekRange } from '@/domain/dates'
import { cn } from '@/lib/browser'
import { useUpdateUserSettings } from '@/state/mutations'
import type { Session } from '@/state/queries'
import { Logo } from './Logo'
import type { NavItem } from './navigation'

export function Sidebar({ items, session, demo }: { items: NavItem[]; session: Session | null; demo: boolean }) {
  const updateSettings = useUpdateUserSettings()
  const sounds = session?.settings.sounds_enabled ?? false

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-white/6 bg-navy-900/80 px-5 py-7 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-3 px-2">
        <Logo size={42} />
        <div>
          <p className="text-[17px] leading-tight font-extrabold tracking-tight">Nuestra Semana</p>
          {demo && <p className="text-xs font-bold text-honey-300">Modo demo</p>}
        </div>
      </div>

      {session && (
        <div className="mt-7 rounded-3xl border border-white/6 bg-white/[0.03] p-4">
          <div className="flex items-center">
            <Avatar profile={session.me} size={40} decorative />
            {session.partner && (
              <div className="-ml-3 rounded-full ring-4 ring-navy-900">
                <Avatar profile={session.partner} size={40} decorative />
              </div>
            )}
          </div>
          <p className="mt-3 truncate text-sm font-extrabold">
            {session.me.display_name}
            {session.partner && <span className="text-navy-300"> & {session.partner.display_name}</span>}
          </p>
          <p className="text-xs text-navy-300">{formatWeekRange(session.calendar.focusWeekStart)}</p>
        </div>
      )}

      <nav aria-label="Principal" className="mt-6 flex-1">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'focus-ring group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-bold transition-colors',
                    isActive ? 'text-ink' : 'text-navy-200 hover:bg-white/5 hover:text-cream-50',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-2xl bg-cream-50"
                        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                      />
                    )}
                    <item.icon className="relative size-5" aria-hidden />
                    <span className="relative flex-1">{item.label}</span>
                    {item.locked && <Lock className="relative size-4 opacity-60" aria-label="Bloqueada" />}
                    {item.attention && (
                      <span className="relative size-2.5 rounded-full bg-blush-400 ring-4 ring-blush-400/20" aria-label="Tienes algo pendiente" />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {session && (
        <button
          type="button"
          onClick={() => updateSettings.mutate({ sounds_enabled: !sounds })}
          className="focus-ring flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-navy-200 transition hover:bg-white/5 hover:text-cream-50"
          aria-pressed={sounds}
        >
          {sounds ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
          Sonidos {sounds ? 'activados' : 'desactivados'}
        </button>
      )}
    </aside>
  )
}
