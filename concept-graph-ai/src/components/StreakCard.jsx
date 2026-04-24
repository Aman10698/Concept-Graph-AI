

export function StreakCard() {
  return (
    <div className="card bg-gradient-to-br from-red-50 to-orange-50 border-l-4 border-red-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-600 text-sm font-medium mb-1">Daily Streak</p>
          <p className="text-4xl font-black text-red-600">12</p>
          <p className="text-xs text-gray-500 mt-2">days in a row</p>
        </div>

      </div>
      <div className="bg-white rounded-lg p-3">
        <div className="flex justify-between text-xs text-gray-600 font-semibold">
          <span>Keep going! 🚀</span>
          <span className="text-green-600">+1 today</span>
        </div>
      </div>
    </div>
  )
}
