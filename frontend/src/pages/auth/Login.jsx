import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Train, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();

  // Mock form state
  const [formData, setFormData] = useState({
    hrmsId: '',
    zone: '',
    division: '',
    password: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real app, validate credentials here. 
    // For now, mock authentication and route to dashboard.
    navigate('/dashboard');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* Left Panel - Branding Graphic */}
      <div className="hidden lg:flex w-1/2 bg-rail-900 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rail-800 to-rail-900"></div>
        <div className="relative z-10 p-12 max-w-lg text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <Train className="w-8 h-8 text-rail-200" />
            </div>
            <span className="text-3xl font-bold">RailOptAI</span>
          </div>
          <h1 className="text-4xl font-extrabold mb-6 leading-tight">
            Centralized Maintenance & Block Planning System
          </h1>
          <p className="text-rail-200 text-lg mb-8">
            Unified scheduling and operations interface integrating TMS, SMMS, and TDMS.
          </p>
          <div className="flex flex-col gap-3 text-sm font-medium text-rail-300">
            <span className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> Secure Personnel Access</span>
            <span className="flex items-center gap-2"><CheckCircleIcon /> Smart Job Prioritization</span>
            <span className="flex items-center gap-2"><CheckCircleIcon /> OR-Tools CP-SAT Engine</span>
            <span className="flex items-center gap-2"><CheckCircleIcon /> Automated Block Generation</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 bg-gray-50">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <div className="text-center mb-8 border-b border-gray-100 pb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Authorized Personnel Login
            </h2>
            <p className="text-gray-500 text-sm">
              Please enter your official credentials to access the block planning portal.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* HRMS ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HRMS ID / Employee Number</label>
              <input 
                type="text" 
                name="hrmsId"
                required 
                value={formData.hrmsId}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rail-600 uppercase" 
                placeholder="E.g. IR1234567" 
              />
            </div>

            {/* Zone & Division Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Railway Zone</label>
                <select 
                  name="zone"
                  required
                  value={formData.zone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rail-600 text-sm"
                >
                  <option value="" disabled>Select Zone</option>
                  <option value="SWR">South Western Railway (SWR)</option>
                  <option value="SR">Southern Railway (SR)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                <select 
                  name="division"
                  required
                  value={formData.division}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rail-600 text-sm"
                >
                  <option value="" disabled>Select Division</option>
                  <option value="Bengaluru">Bengaluru Division (SWR)</option>
                  <option value="Mysuru">Mysuru Division (SWR)</option>
                  <option value="Hubballi">Hubballi Division (SWR)</option>
                  <option value="Chennai">Chennai Division (SR)</option>
                  <option value="Salem">Salem Division (SR)</option>
                </select>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password / PIN</label>
              <input 
                type="password" 
                name="password"
                required 
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rail-600" 
                placeholder="••••••••" 
              />
            </div>


            <div className="flex items-center justify-between pt-2">
              <a href="#" className="text-sm font-medium text-rail-600 hover:text-rail-700">Forgot password?</a>
            </div>

            <button type="submit" className="w-full bg-rail-700 hover:bg-rail-800 text-white font-medium py-3 rounded-lg flex justify-center items-center gap-2 transition-colors mt-4">
              Secure Login <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Official Disclaimer */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong>WARNING:</strong> Unauthorized access to this system is strictly prohibited. Activity is monitored and logged. Violators will be subject to legal action under applicable IT Acts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
