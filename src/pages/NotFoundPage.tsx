import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/feedback/States'

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="app-backdrop" aria-hidden />
      <EmptyState
        icon="🧭"
        title="Esta página no existe"
        description="Puede que el enlace esté mal escrito."
        action={<ButtonLink to="/">Volver al inicio</ButtonLink>}
        className="max-w-md"
      />
    </div>
  )
}
