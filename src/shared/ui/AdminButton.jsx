import { useNavigate } from 'react-router'
import { getUser } from '@/shared/lib/auth'
import { LayoutDashboard } from 'lucide-react'

export function AdminButton() {
  const navigate = useNavigate()
  const user = getUser()
  if (!user) return null

  return (
    <button
      onClick={() => navigate('/admin')}
      title="Admin panel"
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
    >
      <LayoutDashboard size={15} />
      <span className="max-w-[120px] truncate leading-none">{user.name}</span>
    </button>
  )
}
