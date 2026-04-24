import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

import { useState } from 'react'

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [showDiagnostic, setShowDiagnostic] = useState(false)

  // Mock concept graph nodes
  const nodes = [
    { id: 1, label: 'Core OOP', x: 50, y: 20, status: 'strong', color: '#D1FAE5' },
    { id: 2, label: 'Inheritance', x: 20, y: 50, status: 'strong', color: '#D1FAE5' },
    { id: 3, label: 'Polymorphism', x: 50, y: 50, status: 'partial', color: '#FEF3C7' },
    { id: 4, label: 'Encapsulation', x: 80, y: 50, status: 'strong', color: '#D1FAE5' },
    { id: 5, label: 'Abstraction', x: 50, y: 80, status: 'weak', color: '#FEE2E2' },
    { id: 6, label: 'Interfaces', x: 20, y: 80, status: 'weak', color: '#FEE2E2' },
  ]

  const statusColors = {
    strong: { bg: '#D1FAE5', border: '#10B981', glow: 'rgba(16, 185, 129, 0.3)' },
    partial: { bg: '#FEF3C7', border: '#F59E0B', glow: 'rgba(245, 158, 11, 0.3)' },
    weak: { bg: '#FEE2E2', border: '#EF4444', glow: 'rgba(239, 68, 68, 0.3)' },
  }

  const handleNodeClick = (node) => {
    if (node.status === 'weak') {
      setShowDiagnostic(true)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-b border-gray-200/50 z-50">
        <div className="max-w-full px-8 py-4 flex items-center justify-between">
          {/* Left - Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold">
              CG
            </div>
            <span className="font-bold text-lg text-gray-900">ConceptGraphAI</span>
          </div>

          {/* Right - Nav Buttons */}
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium text-gray-600">
              Help
            </button>
            <button 
              onClick={() => isAuthenticated ? navigate('/profile') : navigate('/login')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium text-gray-600"
            >
              Account
            </button>
          </div>
        </div>
      </nav>

      {/* Main Canvas */}
      <div className="pt-20 min-h-screen bg-gradient-to-br from-white via-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-8 py-12">
          {/* Greeting Section */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome, Ramanpreet Kaur</h1>
            <p className="text-lg text-gray-600">MCA Student, Amity University Haryana</p>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Process Card & Instructions */}
            <div className="lg:col-span-1 space-y-6">
              {/* Process Card */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/50 shadow-lg p-8 hover:shadow-xl transition-all">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Step 1: Upload Your Syllabus</h2>
                
                {/* Icon Sequence */}
                <div className="flex items-center justify-between mb-6 text-3xl">
                  <span>📄</span>
                  <span className="text-gray-400">→</span>
                  <span>🔍</span>
                  <span className="text-gray-400">→</span>
                  <span>⚛️</span>
                </div>

                <p className="text-gray-700 text-sm mb-6">Upload your course syllabus (PDF or image). The AI will extract topics and build your knowledge map.</p>

                <button 
                  onClick={() => navigate('/concept-graph')}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:shadow-lg text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  Upload Syllabus
                </button>
              </div>

              {/* Legend Card */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/50 shadow-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 text-sm">Node Status Legend</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded border-2" style={{ borderColor: '#10B981', backgroundColor: '#D1FAE5' }}></div>
                    <span className="text-sm text-gray-700">Strong - Well understood</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded border-2" style={{ borderColor: '#F59E0B', backgroundColor: '#FEF3C7' }}></div>
                    <span className="text-sm text-gray-700">Partial - Needs review</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded border-2" style={{ borderColor: '#EF4444', backgroundColor: '#FEE2E2' }}></div>
                    <span className="text-sm text-gray-700">Weak - Root gap found</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Center Column - Mind Map */}
            <div className="lg:col-span-2">
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/50 shadow-lg p-8 h-96">
                <h2 className="text-lg font-bold text-gray-900 mb-6">Your Knowledge Map</h2>
                
                {/* SVG Mind Map */}
                <svg width="100%" height="280" className="mb-4">
                  {/* Connections */}
                  <line x1="50%" y1="30" x2="20%" y2="140" stroke="#D1D5DB" strokeWidth="2" opacity="0.5" />
                  <line x1="50%" y1="30" x2="50%" y2="140" stroke="#D1D5DB" strokeWidth="2" opacity="0.5" />
                  <line x1="50%" y1="30" x2="80%" y2="140" stroke="#D1D5DB" strokeWidth="2" opacity="0.5" />
                  <line x1="50%" y1="140" x2="20%" y2="220" stroke="#D1D5DB" strokeWidth="2" opacity="0.5" />
                  <line x1="50%" y1="140" x2="50%" y2="220" stroke="#D1D5DB" strokeWidth="2" opacity="0.5" />
                </svg>

                {/* Nodes Grid */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                  {nodes.map((node) => {
                    const colors = statusColors[node.status]
                    return (
                      <button
                        key={node.id}
                        onClick={() => handleNodeClick(node)}
                        style={{
                          backgroundColor: colors.bg,
                          borderColor: colors.border,
                          boxShadow: `0 0 20px ${colors.glow}`,
                        }}
                        className="p-3 rounded-lg border-2 font-semibold text-gray-900 text-sm hover:shadow-lg transform hover:scale-105 transition-all cursor-pointer"
                      >
                        {node.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Panel */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/50 shadow-lg p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  Recent Evaluations
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-200/50">
                    <span className="text-sm text-gray-900"><strong>Inheritance [2]</strong> - Complete</span>
                    <span className="text-xs bg-green-600 text-white px-3 py-1 rounded-full">Strong</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-lg border border-amber-200/50">
                    <span className="text-sm text-gray-900"><strong>Polymorphism [3]</strong> - Complete</span>
                    <span className="text-xs bg-amber-600 text-white px-3 py-1 rounded-full">Partial</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Diagnostic Panel - Floating */}
          {showDiagnostic && (
            <div className="fixed bottom-8 right-8 max-w-md bg-white/95 backdrop-blur-xl rounded-2xl border border-red-200/50 shadow-2xl p-6 animate-fadeInUp">
              <div className="flex items-start gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">Dependency Analysis: Root Gap Found</h3>
                  <p className="text-xs text-gray-500 mt-1">Critical foundational concept</p>
                </div>
              </div>

              <div className="bg-red-50/50 p-4 rounded-lg border border-red-200/50 mb-4">
                <p className="text-sm text-gray-900">
                  <strong>Abstraction</strong> weakness traces to foundational confusion about <strong>Interfaces</strong>.
                </p>
                <p className="text-xs text-gray-600 mt-2">Recommended: Re-attempt the Interfaces prerequisite quiz.</p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDiagnostic(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors"
                >
                  Dismiss
                </button>
                <button 
                  onClick={() => navigate('/practice')}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  Begin Quiz
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
