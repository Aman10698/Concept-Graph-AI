

export function TopicsCard() {
  const topics = [
    { name: 'React Hooks', count: 24 },
    { name: 'State Management', count: 18 },
    { name: 'API Integration', count: 32 },
    { name: 'Performance', count: 15 },
  ]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Top Topics Covered</h2>

      </div>
      <div className="space-y-2">
        {topics.map((topic) => (
          <div key={topic.name} className="flex justify-between items-center p-2 bg-indigo-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">{topic.name}</span>
            <span className="text-xs bg-indigo-500 text-white px-2 py-1 rounded font-semibold">{topic.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
