import { NavLink, Link } from 'react-router-dom'
import { LayoutDashboard, Wrench, Brain, CalendarDays, RefreshCw, LogOut, Train, UserCircle, MapPin, Clock, FileBarChart } from 'lucide-react'

const primaryNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: '1. Dashboard' },
  { to: '/operations/maintenance', icon: Wrench, label: '2. Jobs' },
  { to: '/ai/priority', icon: Brain, label: '3. AI Priority' },
  { to: '/planning/blocks', icon: CalendarDays, label: '4. Block Planner' },
  { to: '/planning/replanning', icon: RefreshCw, label: '5. Replanning' },
]

const extraNav = [
  { to: '/operations/network', icon: MapPin, label: 'Network' },
  { to: '/operations/timetable', icon: Clock, label: 'Timetable' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
]

export default function Sidebar({ isOpen }) {
  return (
    <aside className={`w-64 bg-rail-900 text-white flex flex-col h-screen fixed left-0 top-0 z-30 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="p-2 bg-rail-600 rounded-lg">
          <Train className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">RailOptAI</h1>
          <p className="text-xs text-gray-400">SIH 26027 · SWR Bengaluru</p>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Demo path (8 min)</p>
        {primaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 ${
                isActive ? 'bg-rail-600 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}

        <p className="px-3 mt-5 mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Reference</p>
        {extraNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 ${
                isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 bg-rail-800/50 m-3 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-rail-600 rounded-full flex items-center justify-center shrink-0">
            <UserCircle className="w-6 h-6 text-white" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white leading-tight truncate">Ramesh Kumar</p>
            <p className="text-xs text-rail-300 font-mono mt-0.5">IR1234567</p>
          </div>
        </div>
        <div className="space-y-1.5 mb-4 text-xs text-gray-400 border-t border-white/10 pt-3">
          <p className="flex justify-between"><span>Zone:</span> <span className="text-gray-200 font-medium">SWR</span></p>
          <p className="flex justify-between"><span>Division:</span> <span className="text-gray-200 font-medium">Bengaluru</span></p>
          <p className="flex justify-between"><span>Role:</span> <span className="text-gray-200 font-medium">Ops Head</span></p>
        </div>
        <Link
          to="/login"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded-lg text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Link>
      </div>
    </aside>
  )
}
