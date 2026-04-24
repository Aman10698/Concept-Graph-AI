export function WelcomeCard() {
  const currentHour = new Date().getHours()
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 18 ? 'Good Afternoon' : 'Good Evening'

  return (
    <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-8 text-white card">
      <h1 className="text-3xl font-bold mb-2">{greeting}, Aman Singh!</h1>
      <p className="text-blue-100 mb-6">Keep up the momentum with today's learning goals</p>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
          <div className="text-2xl font-bold">7</div>
          <p className="text-sm text-blue-100">Questions Today</p>
        </div>
        <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
          <div className="text-2xl font-bold">2h 30m</div>
          <p className="text-sm text-blue-100">Time Spent</p>
        </div>
        <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
          <div className="text-2xl font-bold">92%</div>
          <p className="text-sm text-blue-100">Accuracy</p>
        </div>
      </div>
    </div>
  )
}
