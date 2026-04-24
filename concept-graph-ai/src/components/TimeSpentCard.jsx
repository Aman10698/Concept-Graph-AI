

export function TimeSpentCard() {
  const timeData = [
    { day: 'Mon', hours: 2 },
    { day: 'Tue', hours: 3 },
    { day: 'Wed', hours: 1.5 },
    { day: 'Thu', hours: 4 },
    { day: 'Fri', hours: 2.5 },
  ]

  const totalHours = timeData.reduce((sum, d) => sum + d.hours, 0)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-900">Time Spent</h2>

      </div>
      <p className="text-4xl font-bold text-indigo-600 mb-1">{totalHours}h</p>
      <p className="text-xs text-gray-600 mb-4">This week</p>
      <div className="flex gap-1">
        {timeData.map((d) => (
          <div key={d.day} className="flex-1 text-center">
            <div
              className="bg-gradient-to-t from-indigo-500 to-indigo-400 rounded mx-auto mb-1"
              style={{ width: '100%', height: `${Math.max(d.hours * 15, 5)}px` }}
            ></div>
            <span className="text-xs text-gray-600">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
