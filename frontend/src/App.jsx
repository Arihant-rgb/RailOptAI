import { Routes, Route } from 'react-router-dom'
import Layout from './layouts/Layout'
import Landing from './pages/public/Landing'
import Login from './pages/auth/Login'
import Dashboard from './pages/dashboard/Dashboard'
import Maintenance from './pages/operations/Maintenance'
import BlockPlanner from './pages/planning/BlockPlanner'
import RailwayNetwork from './pages/operations/RailwayNetwork'
import TrainTimetable from './pages/operations/TrainTimetable'
import PriorityEngine from './pages/ai/PriorityEngine'
import Replanning from './pages/planning/Replanning'
import Reports from './pages/reports/Reports'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/operations/maintenance" element={<Maintenance />} />
        <Route path="/operations/network" element={<RailwayNetwork />} />
        <Route path="/operations/timetable" element={<TrainTimetable />} />
        <Route path="/planning/blocks" element={<BlockPlanner />} />
        <Route path="/planning/replanning" element={<Replanning />} />
        <Route path="/ai/priority" element={<PriorityEngine />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
    </Routes>
  )
}
