import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Avatar } from '@/components/avatar/Avatar'
import { Logo } from '@/components/layout/Logo'
import type { Profile } from '@/domain/types'

const SAMPLE_A: Pick<Profile, 'id' | 'display_name' | 'avatar' | 'avatar_url' | 'accent'> = {
  id: 'sample-a',
  display_name: 'Tú',
  avatar: { hair: 'short', skin: 1, hairColor: 0 },
  avatar_url: null,
  accent: 'pink',
}
const SAMPLE_B: typeof SAMPLE_A = {
  id: 'sample-b',
  display_name: 'Tu pareja',
  avatar: { hair: 'curly', skin: 2, hairColor: 1 },
  avatar_url: null,
  accent: 'sky',
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="app-backdrop" aria-hidden />
      <aside className="relative hidden overflow-hidden border-r border-white/6 bg-navy-900/60 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <span className="text-xl font-extrabold tracking-tight">Nuestra Semana</span>
        </div>
        <div>
          <div className="flex items-end gap-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
              <Avatar profile={SAMPLE_A} mood={4} size={120} decorative />
            </motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
              <Avatar profile={SAMPLE_B} mood={3} size={96} decorative />
            </motion.div>
          </div>
          <h2 className="mt-8 max-w-md text-4xl leading-tight font-extrabold tracking-tight text-balance">
            Metas en pareja, <span className="text-blush-300">cada semana</span>.
          </h2>
          <ul className="mt-6 space-y-3 text-navy-200">
            <li>🎯 El domingo, cada quien elige sus metas.</li>
            <li>✅ De lunes a viernes, las cumplen día a día.</li>
            <li>🎰 El viernes, quien tuvo menor porcentaje gira la ruleta.</li>
          </ul>
        </div>
        <p className="text-sm text-navy-400">Disciplina hoy, resultados mañana.</p>
      </aside>
      <main className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size={40} />
            <span className="text-lg font-extrabold tracking-tight">Nuestra Semana</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-2 text-navy-300">{subtitle}</div>}
          <div className="mt-8">{children}</div>
        </motion.div>
      </main>
    </div>
  )
}
