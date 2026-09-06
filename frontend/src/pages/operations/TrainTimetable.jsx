import { Clock } from 'lucide-react'

export default function TrainTimetable() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-4 bg-amber-50 rounded-2xl mb-4">
        <Clock className="w-12 h-12 text-amber-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Train Timetable</h2>
      <p className="text-gray-500 max-w-md mb-4">
        Time-distance diagrams, train path visualization, and block-vs-train conflict detection interface.
      </p>
      <span className="badge-info badge">Coming in Phase 2</span>
    </div>
  )
}
