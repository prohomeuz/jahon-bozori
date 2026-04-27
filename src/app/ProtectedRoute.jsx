import { Navigate, Outlet, useLocation } from 'react-router'
import { getToken, getUser } from '@/shared/lib/auth'

function isTokenValid(token) {
  if (!token) return false
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1]))
    // muddati o'tgan bo'lsa ham 60s gacha refresh ulguradi — qat'iy tekshirish emas
    return !exp || exp > Math.floor(Date.now() / 1000)
  } catch { return false }
}

export default function ProtectedRoute() {
  const location = useLocation()
  const user  = getUser()
  const token = getToken()
  if (!user || !isTokenValid(token)) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  return <Outlet />
}
