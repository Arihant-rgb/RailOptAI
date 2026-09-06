import { Brain } from 'lucide-react'

export default function PriorityEngine() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-4 bg-purple-50 rounded-2xl mb-4">
        <Brain className="w-12 h-12 text-purple-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Priority Engine</h2>
      <p className="text-gray-500 max-w-md mb-4">
        AI-powered job prioritization using safety scores, deadline urgency, resource constraints, and bundling optimization.
      </p>
      <span className="badge-info badge">Coming in Phase 2</span>
    </div>
  )
}
