import { useState, useEffect } from 'react'
import { MapPin, Navigation, RefreshCw, Zap, Layers } from 'lucide-react'
import { getStations, getSections } from '../../services/api'
import mockData from '../../data/mockData.json'

export default function RailwayNetwork() {
  const [stations, setStations] = useState([])
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    async function loadNetworkData() {
      try {
        setLoading(true)
        const [stData, secData] = await Promise.all([getStations(), getSections()])
        if (Array.isArray(stData) && stData.length > 0) {
          setStations(stData)
          setSections(secData || [])
          setIsLive(true)
        } else {
          setStations(mockData.stations || [])
          setSections(mockData.sections || [])
          setIsLive(false)
        }
      } catch (err) {
        console.warn('Network page fallback:', err)
        setStations(mockData.stations || [])
        setSections(mockData.sections || [])
        setIsLive(false)
      } finally {
        setLoading(false)
      }
    }
    loadNetworkData()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Railway Network Topology</h2>
          <p className="text-sm text-gray-500">Live section infrastructure, station coordinates, and electrification status</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${isLive ? 'badge-success' : 'badge-info'}`}>
            {isLive ? 'Live Network API' : 'Mock Fallback'}
          </span>
          {loading && <RefreshCw className="w-4 h-4 text-rail-600 animate-spin" />}
        </div>
      </div>

      {/* Grid: Stations & Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stations Table */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rail-600" /> Stations ({stations.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">ID</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Code</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Lat / Long</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((st, idx) => {
                  const id = st.station_id || st.id || st.Station_Code || st.station_code || `ST${idx + 1}`
                  const code = st.station_code || st.code || st.Station_Code || ''
                  const name = st.station_name || st.name || st.Station_Name || ''
                  const lat = st.latitude ?? st.Latitude ?? ''
                  const lng = st.longitude ?? st.Longitude ?? ''
                  return (
                    <tr key={id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-mono text-xs font-medium text-rail-700">{id}</td>
                      <td className="py-2.5 px-3 font-semibold">{code}</td>
                      <td className="py-2.5 px-3">{name}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-500 font-mono">
                        {lat && lng ? `${lat}, ${lng}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sections Table */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-rail-600" /> Railway Sections ({sections.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Section ID</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">From → To</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Distance</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Electrified</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((sec) => (
                  <tr key={sec.section_id || sec.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono text-xs font-bold text-rail-700">{sec.section_id || sec.id}</td>
                    <td className="py-2.5 px-3 font-medium">
                      {sec.from_station} → {sec.to_station}
                    </td>
                    <td className="py-2.5 px-3">{sec.distance_km || sec.distance} km</td>
                    <td className="py-2.5 px-3">
                      <span className={`badge ${sec.electrified ? 'badge-success' : 'badge-warning'}`}>
                        <Zap className="w-3 h-3 inline mr-1" />
                        {sec.electrified ? 'Yes (OHE)' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
