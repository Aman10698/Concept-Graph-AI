

export function StatsCard() {
  return (
    <div className="card bg-gradient-to-br from-purple-50 to-indigo-50 border-l-4 border-indigo-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-600 text-sm font-medium mb-1">Questions Solved</p>
          <p className="text-4xl font-black text-indigo-600">289</p>
        </div>
        <div className="text-4xl">📊</div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-white rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-gray-700 font-medium">Correct</span>
          </div>
          <span className="text-lg font-black text-green-600">220</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-white rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-gray-700 font-medium">Incorrect</span>
          </div>
          <span className="text-lg font-black text-red-600">69</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-pink-200">
        <p className="text-xs text-gray-500 text-center">Accuracy: <span className="font-bold text-indigo-600">76%</span></p>
      </div>
    </div>
  )
}
