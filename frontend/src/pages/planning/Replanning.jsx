import { RefreshCw } from 'lucide-react'

export default function Replanning() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-4 bg-indigo-50 rounded-2xl mb-4">
        <RefreshCw className="w-12 h-12 text-indigo-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Replanning</h2>
      <p className="text-gray-500 max-w-md mb-4">
        Dynamic replanning interface for handling disruptions, emergency blocks, and real-time schedule adjustments.
      </p>
      <span className="badge-info badge">Coming in Phase 2</span>
    </div>
  )
}
