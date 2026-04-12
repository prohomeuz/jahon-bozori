import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import ProtectedRoute from './ProtectedRoute'

const HomePage      = lazy(() => import('@/pages/home/ui/HomePage'))
const BlockPage     = lazy(() => import('@/pages/block/ui/BlockPage'))
const BolimPage     = lazy(() => import('@/pages/bolim/ui/BolimPage'))
const LoginPage     = lazy(() => import('@/pages/admin/ui/LoginPage'))
const AdminLayout   = lazy(() => import('@/pages/admin/ui/AdminLayout'))
const DashboardPage = lazy(() => import('@/pages/admin/ui/DashboardPage'))
const BookingsPage  = lazy(() => import('@/pages/admin/ui/BookingsPage'))
const ManagersPage  = lazy(() => import('@/pages/admin/ui/ManagersPage'))

function Loader() {
  return <div className="fixed inset-0 bg-black" />
}

export default function Router() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
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
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
