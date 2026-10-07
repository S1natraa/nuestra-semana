import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/browser'

interface PageHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8', className)}
    >
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-sm font-semibold text-navy-300">{eyebrow}</div>}
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-tight text-balance sm:text-[40px]">{title}</h1>
        {subtitle && <div className="mt-2 text-[15px] font-medium text-navy-300">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </motion.header>
  )
}
