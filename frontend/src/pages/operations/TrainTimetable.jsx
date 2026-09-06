import { useState, useEffect } from 'react'
import { Clock, Train, ArrowRight, RefreshCw, Calendar } from 'lucide-react'
import { getTrains, getTrainMovements } from '../../services/api'
import mockData from '../../data/mockData.json'

export default function TrainTimetable() {
  const [trains, setTrains] = useState([])
  const [movements, setMovements] = useState([])
  const [selectedDate, setSelectedDate] = useState('2026-09-05')
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [trData, mvData] = await Promise.all([
          getTrains(),
          getTrainMovements({ date: selectedDate })
        ])
        if (Array.isArray(trData) && trData.length > 0) {
          setTrains(trData)
          setMovements(mvData || [])
          setIsLive(true)
        } else {
          setTrains(mockData.trains || [])
          setMovements(mockData.trainMovements || [])
          setIsLive(false)
        }
      } catch (err) {
        console.warn('Train timetable API fallback:', err)
        setTrains(mockData.trains || [])
        setMovements(mockData.trainMovements || [])
        setIsLive(false)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [selectedDate])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Train Timetable & Occupancy</h2>
          <p className="text-sm text-gray-500">Scheduled passenger & freight movements on active railway sections</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="focus:outline-none text-gray-700 bg-transparent"
            />
          </div>
          <span className={`badge ${isLive ? 'badge-success' : 'badge-info'}`}>
            {isLive ? 'Live API Data' : 'Mock Fallback'}
          </span>
          {loading && <RefreshCw className="w-4 h-4 text-rail-600 animate-spin" />}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Train Roster */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
            <Train className="w-5 h-5 text-rail-600" /> Registered Trains ({trains.length})
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {trains.map((t) => (
              <div key={t.train_id || t.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.train_name || t.name}</p>
                  <p className="text-xs text-gray-500 font-mono">ID: {t.train_id || t.id}</p>
                </div>
                <span className={`badge ${
                  t.train_type === 'Express' ? 'badge-info' :
                  t.train_type === 'Freight' ? 'badge-warning' : 'bg-gray-100 text-gray-700'
                }`}>
                  {t.train_type || 'Passenger'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section Occupancy / Movement Schedule Table */}
        <div className="card lg:col-span-2 space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
            <Clock className="w-5 h-5 text-rail-600" /> Train Movements ({movements.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Mvt ID</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Train ID</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Section</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Occupancy Time</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Direction</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, idx) => (
                  <tr key={m.movement_id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono text-xs font-medium text-rail-700">{m.movement_id || `M00${idx+1}`}</td>
                    <td className="py-2.5 px-3 font-mono text-xs font-semibold">{m.train_id}</td>
                    <td className="py-2.5 px-3 font-medium">{m.section_id || m.section}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-700">
                      {m.arrival_time || m.arrivalTime} <ArrowRight className="w-3 h-3 inline mx-1 text-gray-400" /> {m.departure_time || m.departureTime}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`badge ${m.direction === 'UP' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {m.direction || 'UP'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {movements.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No train movements scheduled for this date</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
