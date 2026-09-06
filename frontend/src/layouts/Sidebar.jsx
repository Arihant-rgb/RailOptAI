import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogOut, Train, UserCircle } from 'lucide-react'

export default function Sidebar({ isOpen }) {
  const navigate = useNavigate();

  return (
    <aside className={`w-64 bg-rail-900 text-white flex flex-col h-screen fixed left-0 top-0 z-30 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="p-2 bg-rail-600 rounded-lg">
          <Train className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">RailOptAI</h1>
          <p className="text-xs text-gray-400">Maintenance Optimizer</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-6 px-3">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors duration-150 ${
              isActive
                ? 'bg-rail-600 text-white'
                : 'text-gray-300 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5" />
          Dashboard
        </NavLink>
      </nav>

      {/* Account Info Window */}
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
        
        <div className="space-y-1.5 mb-5 text-xs text-gray-400 border-t border-white/10 pt-3">
          <p className="flex justify-between"><span>Zone:</span> <span className="text-gray-200 font-medium">WCR</span></p>
          <p className="flex justify-between"><span>Division:</span> <span className="text-gray-200 font-medium">Bhopal</span></p>
          <p className="flex justify-between"><span>Role:</span> <span className="text-gray-200 font-medium">Ops Head</span></p>
        </div>
        
        <button 
          onClick={() => navigate('/login')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded-lg text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Secure Sign Out
        </button>
      </div>
    </aside>
  )
}
