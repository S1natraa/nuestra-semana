import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { SplashScreen } from '@/components/feedback/SplashScreen'
import { DashboardSkeleton } from '@/components/feedback/States'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { toAppError } from '@/services/errors'
import { useAuth, AuthProvider } from '@/state/auth'
import { BackendProvider, useBackend } from '@/state/backend'
import { ToastProvider } from '@/state/toast'

const GoalsPage = lazy(() => import('@/pages/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const SetupPage = lazy(() => import('@/pages/SetupPage').then((m) => ({ default: m.SetupPage })))
const ResultPage = lazy(() => import('@/pages/ResultPage').then((m) => ({ default: m.ResultPage })))
const RoulettePage = lazy(() => import('@/pages/RoulettePage').then((m) => ({ default: m.RoulettePage })))
const HistoryPage = lazy(() => import('@/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const JoinLinkPage = lazy(() => import('@/pages/OnboardingPage').then((m) => ({ default: m.JoinLinkPage })))
const DemoLoginPage = lazy(() => import('@/pages/auth/DemoLoginPage').then((m) => ({ default: m.DemoLoginPage })))
const LoginPage = lazy(() => import('@/pages/auth/AuthPages').then((m) => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('@/pages/auth/AuthPages').then((m) => ({ default: m.SignupPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/AuthPages').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/pages/auth/AuthPages').then((m) => ({ default: m.ResetPasswordPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => failureCount < 2 && toAppError(error).retryable,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <BackendProvider>
            <AuthProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </AuthProvider>
          </BackendProvider>
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  )
}

function AppRoutes() {
  const backend = useBackend()
  const demo = backend.mode === 'demo'
  return (
    <Suspense fallback={<SplashScreen />}>
      <Routes>
        <Route path="/entrar" element={<PublicOnly>{demo ? <DemoLoginPage /> : <LoginPage />}</PublicOnly>} />
        {!demo && <Route path="/registro" element={<PublicOnly><SignupPage /></PublicOnly>} />}
        {!demo && <Route path="/recuperar" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />}
        {!demo && <Route path="/restablecer" element={<ResetPasswordPage />} />}
        <Route path="/unirse/:code" element={<JoinLinkPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/bienvenida" element={<OnboardingPage />} />
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="metas" element={<Page><GoalsPage /></Page>} />
            <Route path="configurar" element={<Page><SetupPage /></Page>} />
            <Route path="resultado" element={<Page><ResultPage /></Page>} />
            <Route path="resultado/:weekId" element={<Page><ResultPage /></Page>} />
            <Route path="ruleta" element={<Page><RoulettePage /></Page>} />
            <Route path="historial" element={<Page><HistoryPage /></Page>} />
            <Route path="ajustes" element={<Page><SettingsPage /></Page>} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

/** Carga diferida de una página dentro del shell, con esqueleto (nunca en blanco). */
function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<DashboardSkeleton />}>{children}</Suspense>
}

function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, recovering } = useAuth()
  if (user && !recovering) return <Navigate to="/" replace />
  return <>{children}</>
}
