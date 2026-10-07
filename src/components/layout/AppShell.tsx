import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { Navigate, useLocation, useOutlet } from 'react-router'
import { DemoPanel } from '@/components/demo/DemoPanel'
import { DashboardSkeleton, ErrorState } from '@/components/feedback/States'
import { localStore } from '@/lib/browser'
import { useBackend } from '@/state/backend'
import { useFeedback } from '@/state/feedback'
import { SessionContext, useAppStateQuery, useCoupleRealtime, useSessionMemo, type Session } from '@/state/queries'
import { useToast } from '@/state/toast'
import { BottomNavigation } from './BottomNavigation'
import { buildNavigation } from './navigation'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const query = useAppStateQuery()
  const session = useSessionMemo(query.data)
  const backend = useBackend()
  const location = useLocation()
  const outlet = useOutlet()
  useCoupleRealtime(session?.state.couple?.id)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  if (query.data && !query.data.couple) return <Navigate to="/bienvenida" replace />

  const items = buildNavigation(session)

  return (
    <SessionContext.Provider value={session}>
      <div className="min-h-dvh">
        <div className="app-backdrop" aria-hidden />
        <a
          href="#contenido"
          className="focus-ring sr-only z-50 rounded-full bg-cream-50 px-4 py-2 font-bold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>
        <Sidebar items={items} session={session} demo={backend.mode === 'demo'} />
        <div className="lg:pl-[264px]">
          <main id="contenido" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-36 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
            {query.isPending ? (
              <DashboardSkeleton />
            ) : query.isError || !session ? (
              <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            ) : (
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {outlet}
              </motion.div>
            )}
          </main>
        </div>
        <BottomNavigation items={items} />
        {session && <AchievementWatcher session={session} />}
        {session && backend.mode === 'demo' && <DemoPanel />}
      </div>
    </SessionContext.Provider>
  )
}

/** Avisa cuando se desbloquea un logro nuevo. */
function AchievementWatcher({ session }: { session: Session }) {
  const toast = useToast()
  const feedback = useFeedback()
  const mine = session.state.achievements.filter((a) => a.user_id === session.userId).map((a) => a.code)
  const signature = mine.join(',')

  useEffect(() => {
    const key = `nuestra-semana:seen-achievements:${session.userId}`
    const seen = localStore.get<string[] | null>(key, null)
    const codes = signature ? signature.split(',') : []
    if (seen === null) {
      localStore.set(key, codes)
      return
    }
    const fresh = codes.filter((code) => !seen.includes(code))
    if (fresh.length === 0) return
    for (const code of fresh) {
      const achievement = session.state.achievement_catalog.find((a) => a.code === code)
      if (achievement) {
        toast.show({ tone: 'achievement', title: `¡Logro desbloqueado! ${achievement.icon}`, description: achievement.title })
      }
    }
    feedback.burst({ x: 0.5, y: 0.85 }, 70)
    feedback.sound('achievement')
    localStore.set(key, codes)
  }, [signature, session.userId, session.state.achievement_catalog, toast, feedback])

  return null
}
