

export function ProgressCard() {
  const accuracy = 87

  return (
    <div className="card bg-gradient-to-br from-cyan-50 to-blue-50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-600 text-sm font-medium mb-1">Overall Accuracy</p>
          <p className="text-4xl font-black text-blue-600">{accuracy}%</p>
        </div>

      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Performance</span>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">+5% 📈</span>
        </div>
        <div className="w-full h-3 bg-blue-100 rounded-full overflow-hidden">
          <div 
            className="h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500" 
            style={{ width: `${accuracy}%` }}
          ></div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-blue-200 text-xs text-gray-600 text-center">
        Target: 95% | You're close! Keep practicing 💪
      </div>
    </div>
  )
}
