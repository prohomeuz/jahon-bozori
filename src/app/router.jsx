import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import ProtectedRoute from './ProtectedRoute'
import { getUser } from '@/shared/lib/auth'
import { Navigate } from 'react-router'

function AdminOnly({ children }) {
  const user = getUser()
  if (!user || user.role !== 'admin') return <Navigate to="/admin" replace />
  return children
}

const HomePage      = lazy(() => import('@/pages/home/ui/HomePage'))
const BlockPage     = lazy(() => import('@/pages/block/ui/BlockPage'))
const BolimPage     = lazy(() => import('@/pages/bolim/ui/BolimPage'))
const LoginPage     = lazy(() => import('@/pages/admin/ui/LoginPage'))
const AdminLayout   = lazy(() => import('@/pages/admin/ui/AdminLayout'))
const DashboardPage = lazy(() => import('@/pages/admin/ui/DashboardPage'))
const BookingsPage  = lazy(() => import('@/pages/admin/ui/BookingsPage'))
const ManagersPage  = lazy(() => import('@/pages/admin/ui/ManagersPage'))
const PricesPage    = lazy(() => import('@/pages/admin/ui/PricesPage'))
const ShopsPage     = lazy(() => import('@/pages/admin/ui/ShopsPage'))
const LivePage      = lazy(() => import('@/pages/live/ui/LivePage'))

function Loader() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-6">
      <div className="text-black text-2xl font-bold tracking-[0.25em] select-none">
        JAHON BOZORI
      </div>
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-black/40"
            style={{
              animation: 'loader-dot 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes loader-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default function Router() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/live" element={<LivePage />} />
          <Route path="/admin/login" element={<LoginPage />} />

          {/* Himoyalangan asosiy sahifalar */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/block/:id" element={<BlockPage key={window.location.pathname} />} />
            <Route path="/block/:blockId/bolim/:num" element={<BolimPage />} />
          </Route>

          {/* Admin panel */}
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="managers" element={<ManagersPage />} />
              <Route path="prices" element={<PricesPage />} />
              <Route path="shops" element={<AdminOnly><ShopsPage /></AdminOnly>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/live" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
