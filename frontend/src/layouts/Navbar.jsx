import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { checkHealth } from '../services/api'

const titles = {
  '/dashboard': 'Dashboard',
  '/operations/maintenance': 'Maintenance Jobs',
  '/operations/network': 'Railway Network',
  '/operations/timetable': 'Train Timetable',
  '/planning/blocks': 'Block Planner',
  '/planning/replanning': 'Planning & Replanning',
  '/ai/priority': 'AI Priority Engine',
  '/reports': 'Reports'
}

export default function Navbar({ toggleSidebar }) {
  const [backendStatus, setBackendStatus] = useState('checking')
  const location = useLocation()

  useEffect(() => {
    const verifyBackend = async () => {
      try {
        await checkHealth()
        setBackendStatus('online')
      } catch {
        setBackendStatus('offline')
      }
    }
    verifyBackend()
    const interval = setInterval(verifyBackend, 20000)
    return () => clearInterval(interval)
  }, [])

  const title = titles[location.pathname] || 'RailOptAI'

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-[11px] text-gray-400">Processed TMS / SMMS / TDMS data · week of 5 Sep 2026</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-50">
        <span className={`w-2 h-2 rounded-full ${
          backendStatus === 'online' ? 'bg-emerald-500' :
          backendStatus === 'offline' ? 'bg-red-500' : 'bg-amber-500'
        }`} />
        <span className="text-gray-700 hidden sm:inline">
          {backendStatus === 'online' ? 'API connected' :
           backendStatus === 'offline' ? 'Start backend on :5000' : 'Checking…'}
        </span>
      </div>
    </header>
  )
}
