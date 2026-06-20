import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Home, Users, ClipboardList, Calendar, BarChart2,
  LogOut, Menu, X, ChevronDown, Star
} from 'lucide-react'

const ADMIN_ROLE_LABELS = {
  senior_counselor: 'Старший вожатый',
  senior_educator: 'Старший воспитатель',
  deputy_director: 'Заместитель директора',
  director: 'Директор',
}

export default function Layout({ children }) {
  const { userProfile, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const isAdmin = userProfile?.role === 'admin'

  const counselorLinks = [
    { to: '/counselor', label: 'Главная', icon: Home },
    { to: '/counselor/team', label: 'Моя команда', icon: Users },
    { to: '/counselor/schedule', label: 'История планов', icon: Calendar },
  ]

  const adminLinks = [
    { to: '/admin', label: 'Главная', icon: Home },
    { to: '/admin/teams', label: 'Команды', icon: Users },
    { to: '/admin/reports', label: 'Отчёты', icon: BarChart2 },
    { to: '/admin/dayplan', label: 'План дня', icon: Calendar },
    { to: '/admin/users', label: 'Пользователи', icon: ClipboardList },
  ]

  const links = isAdmin ? adminLinks : counselorLinks

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const isActive = (path) =>
    path === (isAdmin ? '/admin' : '/counselor')
      ? location.pathname === path
      : location.pathname.startsWith(path)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-blue-700 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-300" />
            <span className="font-bold text-lg tracking-wide">Спутник</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive(to) ? 'bg-blue-800 text-white' : 'text-blue-100 hover:bg-blue-600'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <div className="text-sm font-medium">{userProfile?.fullName}</div>
              <div className="text-xs text-blue-200">
                {isAdmin ? ADMIN_ROLE_LABELS[userProfile?.adminRole] || 'Администратор' : `Команда ${userProfile?.teamNumber || '—'}`}
              </div>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-blue-600 transition-colors" title="Выйти">
              <LogOut className="w-5 h-5" />
            </button>
            <button className="md:hidden p-1.5 rounded-lg hover:bg-blue-600" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden bg-blue-800 px-4 pb-3">
            <div className="text-sm text-blue-200 py-2 border-b border-blue-700 mb-2">
              {userProfile?.fullName} · {isAdmin ? ADMIN_ROLE_LABELS[userProfile?.adminRole] || 'Администратор' : `Команда ${userProfile?.teamNumber || '—'}`}
            </div>
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors
                  ${isActive(to) ? 'bg-blue-900 text-white' : 'text-blue-100 hover:bg-blue-700'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      <footer className="text-center text-xs text-gray-400 py-3 border-t border-gray-200">
        ДОЦ Спутник © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
