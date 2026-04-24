import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts'


const data = [
  { name: 'Mon', value: 40 },
  { name: 'Tue', value: 60 },
  { name: 'Wed', value: 30 },
  { name: 'Thu', value: 80 },
]

export function ChartCard() {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Progress</h2>

      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis dataKey="name" />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
