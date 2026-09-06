import { MapPin } from 'lucide-react'

export default function RailwayNetwork() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-4 bg-blue-50 rounded-2xl mb-4">
        <MapPin className="w-12 h-12 text-rail-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Railway Network Map</h2>
      <p className="text-gray-500 max-w-md mb-4">
        Interactive Leaflet map showing the railway network, stations, sections, and real-time maintenance activity overlays.
      </p>
      <span className="badge-info badge">Coming in Phase 2</span>
    </div>
  )
}
