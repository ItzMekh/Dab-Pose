interface Stats {
  bestTime: number | null
  bestStreak: number | null
  totalPlays: number
}

interface Props {
  stats: Stats
}

export default function OverviewTab({ stats }: Props) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-white text-xl font-bold">Overview</h2>
        <p className="text-gray-500 text-sm">All-time stats</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚡</span>
            <p className="text-gray-500 text-xs font-semibold tracking-widest uppercase">Best Reaction</p>
          </div>
          {stats.bestTime !== null ? (
            <p className="text-purple-400 font-black leading-none">
              <span className="text-5xl">{stats.bestTime}</span>
              <span className="text-gray-500 text-base font-normal ml-1">ms</span>
            </p>
          ) : (
            <p className="text-gray-600 text-3xl font-black">—</p>
          )}
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🔥</span>
            <p className="text-gray-500 text-xs font-semibold tracking-widest uppercase">Best Streak</p>
          </div>
          {stats.bestStreak !== null ? (
            <p className="text-orange-400 font-black leading-none">
              <span className="text-5xl">{stats.bestStreak}</span>
              <span className="text-gray-500 text-base font-normal ml-1">dabs</span>
            </p>
          ) : (
            <p className="text-gray-600 text-3xl font-black">—</p>
          )}
        </div>
      </div>

      <div className="bg-white/3 border border-white/8 rounded-2xl p-6 flex items-center gap-4">
        <span className="text-3xl">🎮</span>
        <div>
          <p className="text-amber-400 text-4xl font-black leading-none">{stats.totalPlays.toLocaleString('en-US')}</p>
          <p className="text-gray-500 text-sm mt-1">Total Plays</p>
        </div>
      </div>

      {stats.totalPlays === 0 && (
        <p className="text-gray-600 text-sm text-center py-8">
          No scored games yet. Play a game and sign in to track your stats!
        </p>
      )}
    </div>
  )
}
