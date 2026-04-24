

export function WeakAreasCard() {
  const weakAreas = [
    { name: 'Algorithms', percentage: 35, color: '#ef4444' },
    { name: 'Data Structures', percentage: 52, color: '#f97316' },
    { name: 'Database', percentage: 68, color: '#eab308' },
    { name: 'API Design', percentage: 78, color: '#84cc16' },
  ]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Weak Areas</h2>

      </div>
      <div className="space-y-3">
        {weakAreas.map((area) => (
          <div key={area.name}>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{area.name}</span>
              <span className="text-xs text-gray-500">{area.percentage}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${area.percentage}%`, backgroundColor: area.color }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
