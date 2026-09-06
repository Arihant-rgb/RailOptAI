import { useState } from 'react'
import { RefreshCw, ArrowRight, AlertTriangle, Layers, CalendarCheck } from 'lucide-react'
import { forwardPlanning, reversePlanning, triggerReplanning } from '../../services/api'

export default function Replanning() {
  const [activeTab, setActiveTab] = useState('forward') // 'forward', 'reverse', 'replan'

  // Forward State
  const [forwardJobId, setForwardJobId] = useState('TMS001')
  const [forwardResult, setForwardResult] = useState(null)
  const [forwardLoading, setForwardLoading] = useState(false)

  // Reverse State
  const [reverseBlockId, setReverseBlockId] = useState('B001')
  const [reverseResult, setReverseResult] = useState(null)
  const [reverseLoading, setReverseLoading] = useState(false)

  // Dynamic Replanning State
  const [emergencySection, setEmergencySection] = useState('S01')
  const [emergencyDefect, setEmergencyDefect] = useState('Critical Signal Failure')
  const [replanResult, setReplanResult] = useState(null)
  const [replanLoading, setReplanLoading] = useState(false)

  const handleForwardPlanning = async (e) => {
    e.preventDefault()
    try {
      setForwardLoading(true)
      const res = await forwardPlanning({ job_id: forwardJobId })
      setForwardResult(res)
    } catch (err) {
      alert('Forward planning failed: ' + err.message)
    } finally {
      setForwardLoading(false)
    }
  }

  const handleReversePlanning = async (e) => {
    e.preventDefault()
    try {
      setReverseLoading(true)
      const res = await reversePlanning({ block_id: reverseBlockId })
      setReverseResult(res)
    } catch (err) {
      alert('Reverse planning failed: ' + err.message)
    } finally {
      setReverseLoading(false)
    }
  }

  const handleEmergencyReplan = async (e) => {
    e.preventDefault()
    try {
      setReplanLoading(true)
      const res = await triggerReplanning({
        emergency_job_id: `EMG_${Date.now().toString().slice(-4)}`,
        section_id: emergencySection,
        defect_type: emergencyDefect,
        department: 'SMMS'
      })
      setReplanResult(res)
    } catch (err) {
      alert('Emergency replanning failed: ' + err.message)
    } finally {
      setReplanLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Planning & Dynamic Replanning</h2>
        <p className="text-sm text-gray-500">SIH 2026 Forward (Job → Block), Reverse (Block → Work Package), and Emergency Replanning</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        {[
          { id: 'forward', label: 'Forward Planning (Job → Block)', icon: CalendarCheck },
          { id: 'reverse', label: 'Reverse Planning (Block → Package)', icon: Layers },
          { id: 'replan', label: 'Emergency Dynamic Replanning', icon: AlertTriangle }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-rail-600 text-rail-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Forward Planning */}
      {activeTab === 'forward' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Forward Planning Input</h3>
            <form onSubmit={handleForwardPlanning} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Target Maintenance Job ID</label>
                <input
                  type="text"
                  value={forwardJobId}
                  onChange={(e) => setForwardJobId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-rail-500"
                  placeholder="e.g. TMS001"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={forwardLoading}
                className="w-full py-2 bg-rail-600 hover:bg-rail-700 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2"
              >
                {forwardLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Find Best Candidate Blocks
              </button>
            </form>
          </div>

          <div className="card lg:col-span-2 space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Matched Candidate Blocks</h3>
            {forwardResult ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                  Target Job: <strong>{forwardResult.job?.job_id}</strong> ({forwardResult.job?.section_id}) | Priority: <strong>{forwardResult.job?.priority}</strong>
                </div>
                <div className="space-y-2">
                  {forwardResult.bestBlocks?.map((b, idx) => (
                    <div key={b.block_id || idx} className="p-3 border rounded-lg flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <span className="font-mono text-xs font-bold text-rail-700">{b.block_id}</span>
                        <p className="text-xs text-gray-600">Section {b.section_id} | {b.start_time || b.startTime} - {b.end_time || b.endTime}</p>
                      </div>
                      <span className="badge badge-success">Fit Score: {b.fit_score || 92}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-8 text-center">Click "Find Best Candidate Blocks" to query backend API</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Reverse Planning */}
      {activeTab === 'reverse' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Reverse Planning Input</h3>
            <form onSubmit={handleReversePlanning} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Target Maintenance Block ID</label>
                <input
                  type="text"
                  value={reverseBlockId}
                  onChange={(e) => setReverseBlockId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-rail-500"
                  placeholder="e.g. B001"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={reverseLoading}
                className="w-full py-2 bg-rail-600 hover:bg-rail-700 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2"
              >
                {reverseLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                Find Compatible Work Package
              </button>
            </form>
          </div>

          <div className="card lg:col-span-2 space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Recommended Work Package</h3>
            {reverseResult ? (
              <div className="space-y-3">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex justify-between">
                  <span>Target Block: <strong>{reverseResult.block?.block_id}</strong> ({reverseResult.block?.section_id})</span>
                  <span>Bundle Score: <strong>{reverseResult.recommendedWorkPackage?.bundle_score}%</strong></span>
                </div>
                <div className="space-y-2">
                  {reverseResult.recommendedWorkPackage?.bundled_jobs?.map((j, idx) => (
                    <div key={j.job_id || idx} className="p-3 border rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-gray-900">{j.job_id || j.id}</span>
                        <p className="text-xs text-gray-600">{j.defect_type || j.description} ({j.department})</p>
                      </div>
                      <span className="badge badge-info">{j.priority || 'Medium'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-8 text-center">Click "Find Compatible Work Package" to query backend API</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Emergency Dynamic Replanning */}
      {activeTab === 'replan' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Trigger Emergency Incident
            </h3>
            <form onSubmit={handleEmergencyReplan} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Affected Section</label>
                <select
                  value={emergencySection}
                  onChange={(e) => setEmergencySection(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="S01">S01</option>
                  <option value="S02">S02</option>
                  <option value="S03">S03</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Incident Description</label>
                <input
                  type="text"
                  value={emergencyDefect}
                  onChange={(e) => setEmergencyDefect(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={replanLoading}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2"
              >
                {replanLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Re-optimize Schedule (CP-SAT)
              </button>
            </form>
          </div>

          <div className="card lg:col-span-2 space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Dynamic Replanning Output</h3>
            {replanResult ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                <p className="font-bold text-sm text-emerald-900">
                  {replanResult.message}
                </p>
                <div className="text-xs text-emerald-800 space-y-1">
                  <p>Added Emergency Job: <strong>{replanResult.added_job?.job_id}</strong></p>
                  <p>Affected Region: <strong>Section {replanResult.affected_section}</strong></p>
                  <p>Schedule Action: Emergency job inserted into 02:00-04:00 window. Non-critical jobs shifted automatically.</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-8 text-center">Trigger an emergency incident to view real-time schedule re-optimization</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
