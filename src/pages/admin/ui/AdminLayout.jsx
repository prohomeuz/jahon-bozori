import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { getUser, removeToken } from '@/shared/lib/auth'
import { LayoutDashboard, Users, ClipboardList, LogOut, Home, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

const NAV = [
  { to: '/admin',          label: 'Dashboard',       icon: LayoutDashboard, end: true },
  { to: '/admin/bookings', label: 'Bitimlar',         icon: ClipboardList },
  { to: '/admin/managers', label: 'Salesmanagerlar',  icon: Users, adminOnly: true },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!user) navigate('/admin/login', { replace: true })
  }, [])

  function logout() {
    removeToken()
    navigate('/admin/login', { replace: true })
  }

  if (!user) return null

  return (
    <div className="fixed inset-0 flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? 'w-14' : 'w-52'} shrink-0 border-r border-border flex flex-col transition-[width] duration-200 ease-in-out overflow-hidden`}
      >
        {/* Header */}
        <div className={`h-15 border-b border-border flex items-center shrink-0 ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate">Jahon Bozori</p>
              <p className="text-xs text-muted-foreground">Boshqaruv paneli</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title={collapsed ? 'Kengaytirish' : 'Yig\'ish'}
          >
            {collapsed
              ? <PanelLeftOpen size={16} />
              : <PanelLeftClose size={16} />
            }
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto">
          {NAV.filter(n => !n.adminOnly || isAdmin).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl text-sm font-medium transition-colors
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
                ${isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`
              }
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom nav */}
        <div className={`p-2 border-t border-border flex flex-col gap-1`}>
          <NavLink
            to="/"
            title={collapsed ? 'Bosh sahifa' : undefined}
            className={`flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors
              ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}`}
          >
            <Home size={16} className="shrink-0" />
            {!collapsed && <span>Bosh sahifa</span>}
          </NavLink>
          <button
            onClick={logout}
            title={collapsed ? 'Chiqish' : undefined}
            className={`flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full
              ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5 text-left'}`}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Chiqish</span>}
          </button>
        </div>

        {/* User info */}
        <div className={`border-t border-border flex items-center gap-2 shrink-0
          ${collapsed ? 'justify-center px-0 py-3' : 'px-3 py-3'}`}>
          {collapsed ? (
            <div
              className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0"
              title={user.name}
            >
              {user.name?.[0]?.toUpperCase()}
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground">{isAdmin ? 'Admin' : 'Salesmanager'}</p>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
