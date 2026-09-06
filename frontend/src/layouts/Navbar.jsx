import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Search, Bell, ChevronDown, Wrench, MapPin, Clock, CalendarDays, RefreshCw, Brain, FileBarChart, Menu, Activity } from 'lucide-react'
import { checkHealth } from '../services/api'

export default function Navbar({ toggleSidebar }) {
  const [openDropdown, setOpenDropdown] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online', 'offline', 'checking'
  const location = useLocation();

  useEffect(() => {
    const verifyBackend = async () => {
      try {
        await checkHealth();
        setBackendStatus('online');
      } catch (err) {
        setBackendStatus('offline');
      }
    };
    verifyBackend();
    const interval = setInterval(verifyBackend, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when route changes
  useEffect(() => {
    setOpenDropdown(null);
  }, [location.pathname]);

  const toggleDropdown = (name) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive ? 'bg-rail-50 text-rail-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
      
      {/* Left: Toggle & Horizontal Navigation Modules */}
      <div className="flex items-center gap-4">
        {/* Toggle Button */}
        <button 
          onClick={toggleSidebar}
          className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-rail-500"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav className="flex items-center gap-2 relative">
        
        {/* Operations Dropdown */}
        <div className="relative">
          <button 
            onClick={() => toggleDropdown('operations')}
            className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location.pathname.includes('/operations') || openDropdown === 'operations'
                ? 'bg-rail-50 text-rail-700' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Operations <ChevronDown className={`w-4 h-4 transition-transform ${openDropdown === 'operations' ? 'rotate-180' : ''}`} />
          </button>
          
          {openDropdown === 'operations' && (
            <>
              {/* Invisible overlay to click outside */}
              <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                <NavItem to="/operations/maintenance" icon={Wrench} label="Maintenance Jobs" />
                <NavItem to="/operations/network" icon={MapPin} label="Railway Network" />
                <NavItem to="/operations/timetable" icon={Clock} label="Train Timetable" />
              </div>
            </>
          )}
        </div>

        {/* Planning Dropdown */}
        <div className="relative">
          <button 
            onClick={() => toggleDropdown('planning')}
            className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location.pathname.includes('/planning') || openDropdown === 'planning'
                ? 'bg-rail-50 text-rail-700' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Planning <ChevronDown className={`w-4 h-4 transition-transform ${openDropdown === 'planning' ? 'rotate-180' : ''}`} />
          </button>
          
          {openDropdown === 'planning' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                <NavItem to="/planning/blocks" icon={CalendarDays} label="Block Planner" />
                <NavItem to="/planning/replanning" icon={RefreshCw} label="Replanning" />
              </div>
            </>
          )}
        </div>

        {/* Single Links */}
        <NavItem to="/ai/priority" icon={Brain} label="AI Priority" />
        <NavItem to="/reports" icon={FileBarChart} label="Reports" />
      </nav>
      </div>

      {/* Right: Global Tools & Backend Status */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Backend Status Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-50">
          <span className={`w-2 h-2 rounded-full ${
            backendStatus === 'online' ? 'bg-emerald-500 animate-pulse' :
            backendStatus === 'offline' ? 'bg-red-500' : 'bg-amber-500'
          }`} />
          <span className="text-gray-700 hidden sm:inline">
            {backendStatus === 'online' ? 'Backend Connected' :
             backendStatus === 'offline' ? 'Backend Offline' : 'Checking API...'}
          </span>
        </div>

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search blocks, jobs..."
            className="pl-9 pr-4 py-1.5 w-48 lg:w-64 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rail-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ml-1">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
      </div>
    </header>
  )
}
