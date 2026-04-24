import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { QuickStartGuide } from '../components/QuickStartGuide'

export default function EnhancedHomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Master Any Concept with <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">AI-Powered Learning</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Upload documents, extract key concepts, practice with adaptive questions, and identify your learning gaps with advanced root cause analysis.
            </p>
            <div className="flex gap-4">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Go to Dashboard
                  </Link>
                  <Link
                    to="/practice"
                    className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Start Practice
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl h-96 flex items-center justify-center text-white text-2xl font-bold">
            📚 Learning Platform
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-4xl font-bold text-center mb-16">Powerful Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: '📄', title: 'Smart Analysis', desc: 'Extract key concepts from PDFs with OCR' },
              { icon: '🧠', title: 'Adaptive Learning', desc: '10+ question types across difficulty levels' },
              { icon: '📊', title: 'Visual Insights', desc: 'Mind maps and concept graphs for clarity' },
              { icon: '🎯', title: 'Root Cause Analysis', desc: 'Identify weakest foundational concepts' },
            ].map((feature, i) => (
              <div key={i} className="card p-6 text-center">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      {isAuthenticated && <QuickStartGuide />}

      {/* CTA Section */}
      {isAuthenticated && (
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
          <div className="max-w-7xl mx-auto px-8 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">Ready to Level Up Your Learning?</h2>
            <div className="flex gap-4 justify-center">
              <Link
                to="/dashboard"
                className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                View Dashboard
              </Link>
              <Link
                to="/practice"
                className="border-2 border-white text-white hover:bg-white/10 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Start Practicing
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
