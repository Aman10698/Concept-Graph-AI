import { Link } from 'react-router-dom'

export function QuickStartGuide() {
  const steps = [
    {
      number: 1,
      title: 'Upload a Document',
      description: 'Upload PDFs, images, or documents to analyze',
      action: 'Concept Graph',
      link: '/syllabuses',
      icon: '📄',
      color: 'blue',
    },
    {
      number: 2,
      title: 'Extract Key Concepts',
      description: 'AI extracts important topics and concepts automatically',
      action: 'View Results',
      link: '/dashboard',
      icon: '🧠',
      color: 'purple',
    },
    {
      number: 3,
      title: 'Practice Questions',
      description: 'Answer adaptive questions across different difficulty levels',
      action: 'Start Practice',
      link: '/practice',
      icon: '❓',
      color: 'orange',
    },
    {
      number: 4,
      title: 'Track Progress',
      description: 'Monitor your learning journey with comprehensive analytics',
      action: 'View Dashboard',
      link: '/dashboard',
      icon: '📊',
      color: 'green',
    },
  ]

  const colorClasses = {
    blue: 'from-blue-100 to-blue-50 border-blue-200',
    purple: 'from-purple-100 to-purple-50 border-purple-200',
    orange: 'from-orange-100 to-orange-50 border-orange-200',
    green: 'from-green-100 to-green-50 border-green-200',
  }

  return (
    <section className="py-16 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-gray-600">Get started in 4 simple steps</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`bg-gradient-to-br ${colorClasses[step.color]} border-2 rounded-2xl p-6 transition-all hover:shadow-lg relative`}
            >
              {/* Step number */}
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-white rounded-full border-2 border-inherit flex items-center justify-center font-bold text-lg">
                {step.number}
              </div>

              {/* Icon */}
              <div className="text-4xl mb-4 mt-4">{step.icon}</div>

              {/* Content */}
              <h3 className="font-bold text-lg mb-2">{step.title}</h3>
              <p className="text-sm text-gray-600 mb-6">{step.description}</p>

              {/* Link */}
              <Link
                to={step.link}
                className="inline-block text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                {step.action} →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
