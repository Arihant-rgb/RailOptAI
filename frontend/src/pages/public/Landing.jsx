import { Link } from 'react-router-dom';
import { Train, ArrowRight, Database, Brain, Calendar, SplitSquareHorizontal, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed w-full bg-white/90 backdrop-blur-md border-b border-gray-100 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rail-600 rounded-lg">
                <Train className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-rail-900">RailOptAI</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#features" className="text-sm font-medium text-gray-600 hover:text-rail-600">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-rail-600">How it Works</a>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-rail-600">Sign In</Link>
              <Link to="/login" className="btn-primary text-sm px-4 py-2">Get Started</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">

        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
          AI-Powered Automatic <span className="text-transparent bg-clip-text bg-gradient-to-r from-rail-600 to-blue-800">Block Planning</span> for Indian Railways
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Maximize asset availability and minimize train disruptions. RailOptAI unifies maintenance data, detects timetable gaps, and optimizes scheduling using constraint programming and explainable AI.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/login" className="btn-primary text-lg px-8 py-3 flex items-center gap-2">
            Access Platform <ArrowRight className="w-5 h-5" />
          </Link>
          <a href="#features" className="btn-secondary text-lg px-8 py-3">Explore Features</a>
        </div>
        
        {/* KPI Stats Strip */}
        <div className="mt-16 mx-auto max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Jobs', value: '342', sub: 'Active maintenance tasks', color: 'text-rail-700', bg: 'bg-blue-50', border: 'border-blue-100' },
            { label: 'Available Blocks', value: '56', sub: 'Open time windows', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Utilization Rate', value: '78.5%', sub: 'Block efficiency score', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
            { label: 'Active Conflicts', value: '12', sub: 'Requires resolution', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100' },
          ].map((stat, i) => (
            <div key={i} className={`${stat.bg} border ${stat.border} rounded-2xl p-6 text-left shadow-sm`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{stat.label}</p>
              <p className={`text-4xl font-extrabold ${stat.color} mb-1`}>{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem vs Solution */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Core Capabilities</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">From fragmented operations to unified, AI-optimized schedules.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Database, title: "Unified Operations", desc: "Ingests and normalizes data from Track (TMS), Signalling (SMMS), and Traction (TDMS) workflows." },
              { icon: Brain, title: "Explainable AI Priority", desc: "Ranks jobs transparently by Criticality, Urgency, Asset Impact, and Delay Risk." },
              { icon: Calendar, title: "Automated Block Gen", desc: "Analyzes train timetables (Express, Freight) to find safe, viable maintenance windows." },
              { icon: SplitSquareHorizontal, title: "CP-SAT Optimization", desc: "Uses Google OR-Tools to assign jobs, prevent double-booking, and bundle compatible work." },
              { icon: ShieldAlert, title: "Dynamic Replanning", desc: "Instantly adapt to emergencies by freezing unaffected jobs and re-optimizing the affected section." },
              { icon: CheckCircle2, title: "Cross-Dept Bundling", desc: "Maximizes block utilization by safely combining OHE, Track, and Signal work in the same window." }
            ].map((feature, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-rail-50 text-rail-600 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Flow */}
      <section id="how-it-works" className="py-20">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-12">How It Works</h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
               {['Data Ingestion', 'Intelligence (AI)', 'Block Detection', 'Optimization', 'Emergency Response'].map((step, i) => (
                 <div key={i} className="flex items-center gap-4 md:gap-8">
                    <div className="flex flex-col items-center">
                       <div className="w-16 h-16 rounded-full bg-rail-600 text-white flex items-center justify-center font-bold text-xl mb-3 shadow-lg">
                         {i + 1}
                       </div>
                       <span className="text-sm font-medium text-gray-700">{step}</span>
                    </div>
                    {i < 4 && <ArrowRight className="hidden md:block w-6 h-6 text-gray-300" />}
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Train className="w-6 h-6 text-rail-500" />
            <span className="text-xl font-bold text-white">RailOptAI</span>
          </div>
          <p className="text-gray-500 text-sm">© 2024 RailOptAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
