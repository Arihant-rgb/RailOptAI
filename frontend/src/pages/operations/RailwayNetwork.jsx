import { useState } from 'react'
import { MapPin, ChevronDown, ChevronRight, Train } from 'lucide-react'
import mockData from '../../data/mockData.json'

export default function RailwayNetwork() {
  const [expandedSection, setExpandedSection] = useState(mockData.sections[0]?.id || null)

  const toggleSection = (id) => {
    setExpandedSection(expandedSection === id ? null : id)
  }

  const selected = mockData.sections.find(s => s.id === expandedSection)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Railway Network</h1>
        <p className="text-sm text-gray-500 mt-1">Sections, stations, and infrastructure overview for the operational zone.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Panel — Sections & Stations Accordion */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Train className="w-4 h-4 text-rail-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Sections & Stations</h2>
            <span className="ml-auto text-xs text-gray-400">{mockData.sections.length} sections</span>
          </div>

          <div className="divide-y divide-gray-50">
            {mockData.sections.map((section) => (
              <div key={section.id}>
                {/* Section Header Row */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-rail-50 rounded-lg flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-rail-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{section.name}</p>
                      <p className="text-xs text-gray-400">{section.id} · {section.stations.length} stations</p>
                    </div>
                  </div>
                  {expandedSection === section.id
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  }
                </button>

                {/* Station List (Expanded) */}
                {expandedSection === section.id && (
                  <div className="bg-gray-50 border-t border-gray-100">
                    {section.stations.map((station, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-2.5 h-2.5 rounded-full border-2 ${idx === 0 || idx === section.stations.length - 1 ? 'bg-rail-600 border-rail-600' : 'bg-white border-rail-400'}`}></div>
                          {idx < section.stations.length - 1 && <div className="w-0.5 h-4 bg-rail-200"></div>}
                        </div>
                        <span className="text-sm text-gray-700">{station}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel — Section Detail Cards */}
        <div className="space-y-4">
          {mockData.sections.map((section) => (
            <div
              key={section.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 transition-all cursor-pointer ${
                expandedSection === section.id ? 'border-rail-300 ring-2 ring-rail-100' : 'border-gray-100 hover:border-gray-200'
              }`}
              onClick={() => toggleSection(section.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-bold text-gray-900">{section.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Section ID: {section.id}</p>
                </div>
                <span className="bg-rail-50 text-rail-700 text-xs font-semibold px-3 py-1 rounded-full">
                  {section.stations.length} Stations
                </span>
              </div>

              {/* Station Badges */}
              <div className="flex flex-wrap gap-2">
                {section.stations.map((station, idx) => (
                  <span
                    key={idx}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      idx === 0 || idx === section.stations.length - 1
                        ? 'bg-rail-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {station}
                  </span>
                ))}
              </div>

              {/* Terminal Indicator */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                <span>Origin: <span className="font-medium text-gray-700">{section.stations[0]}</span></span>
                <span>Terminus: <span className="font-medium text-gray-700">{section.stations[section.stations.length - 1]}</span></span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
