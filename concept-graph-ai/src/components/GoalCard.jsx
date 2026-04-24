export function GoalCard() {
  const goals = [
    { name: '30-day Streak', current: 2, target: 30, icon: '🔥' },
    { name: 'Learn 100 Topics', current: 47, target: 100, icon: '📚' },
    { name: 'Practice 500 Questions', current: 289, target: 500, icon: '❓' },
  ]

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Your Goals</h2>
      <div className="space-y-4">
        {goals.map((goal) => (
          <div key={goal.name}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{goal.icon}</span>
                <span className="font-medium text-sm">{goal.name}</span>
              </div>
              <span className="text-xs text-gray-500">{goal.current}/{goal.target}</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                style={{ width: `${(goal.current / goal.target) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
