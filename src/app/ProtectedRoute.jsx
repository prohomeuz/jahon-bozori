import { Navigate, Outlet, useLocation } from 'react-router'
import { getUser } from '@/shared/lib/auth'

export default function ProtectedRoute() {
  const location = useLocation()
  if (!getUser()) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  return <Outlet />
}
