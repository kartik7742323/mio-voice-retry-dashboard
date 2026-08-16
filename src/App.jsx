import { useState } from 'react'
import { Routes, Route, NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  PhoneCall,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import { useAuth } from './auth/AuthContext'
import { useTheme } from './lib/theme'
import { FilterProvider, useFilter } from './context/FilterContext'
import FilterBar from './components/FilterBar'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Institutions from './pages/Institutions'
import InstitutionDetail from './pages/InstitutionDetail'
import summaryData from './data/summary.json'
import { formatDate } from './lib/format'

const navItems = [
  { to: '/',             label: 'Overview',     icon: LayoutDashboard },
  { to: '/institutions', label: 'Institutions', icon: Building2 },
]

function NavItem({ to, label, icon: Icon, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
        }`
      }
    >
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  )
}

function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
        dark
          ? 'bg-slate-700 hover:bg-slate-600 text-amber-400'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
      }`}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}

function Dashboard() {
  const { logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const date = formatDate(summaryData.extracted_date)

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top nav */}
      <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-700/60 flex items-center px-4 gap-3 z-10">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="hidden md:flex w-9 h-9 rounded-xl bg-indigo-600 items-center justify-center shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 transition-colors shrink-0"
          aria-label="Toggle sidebar"
        >
          <PhoneCall size={16} className="text-white" />
        </button>
        <div className="md:hidden w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-600/30 shrink-0">
          <PhoneCall size={16} className="text-white" />
        </div>
        <Link to="/" className="flex-1 hover:opacity-75 transition-opacity">
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
            MIO AI VOICE · RETRY
          </span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`hidden md:flex shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-700/60 flex-col transition-all duration-200 ${
            collapsed ? 'w-[60px]' : 'w-52'
          }`}
        >
          <nav className="flex-1 px-2 py-3 space-y-1">
            {navItems.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
          </nav>

          <div className="px-2 py-3 border-t border-slate-100 dark:border-slate-700/60">
            {!collapsed && (
              <div className="px-3 mb-2">
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Last extracted</p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">{date}</p>
              </div>
            )}
            <button
              onClick={logout}
              title={collapsed ? 'Sign out' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <LogOut size={16} className="shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <FilterBar />
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            <FilteredRoutes />
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-around px-2 py-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl text-[10px] font-semibold transition-colors ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          onClick={logout}
          className="flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span>Sign out</span>
        </button>
      </nav>
    </div>
  )
}

function FilteredRoutes() {
  const { view } = useFilter()
  return (
    <Routes>
      <Route path="/"                 element={<Overview data={view} />} />
      <Route path="/institutions"     element={<Institutions data={view} />} />
      <Route path="/institutions/:id" element={<InstitutionDetail />} />
    </Routes>
  )
}

export default function App() {
  const { authed } = useAuth()
  if (!authed) return <Login />
  return (
    <FilterProvider>
      <Dashboard />
    </FilterProvider>
  )
}
