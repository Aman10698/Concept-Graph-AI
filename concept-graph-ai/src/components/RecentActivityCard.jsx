export function RecentActivityCard() {
  const activities = [
    { type: 'Completed Quiz', title: 'React Hooks Deep Dive', time: '2 hours ago', icon: '✓', color: 'green' },
    { type: 'Concept Extracted', title: 'Database Normalization', time: '5 hours ago', icon: '📄', color: 'blue' },
    { type: 'Mind Map Created', title: 'Web Development Path', time: '1 day ago', icon: '🧠', color: 'purple' },
    { type: 'Streak Updated', title: 'Keep it going!', time: 'Today', icon: '🔥', color: 'orange' },
  ]

  const colorMap = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
      <div className="space-y-3">
        {activities.map((activity, i) => (
          <div key={i} className="flex gap-3 pb-3 border-b last:border-b-0">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colorMap[activity.color]}`}>
              {activity.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900">{activity.title}</p>
              <p className="text-xs text-gray-500">{activity.type} • {activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
