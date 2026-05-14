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
        <h2 className="text-white text-lg font-bold">Overview</h2>
        <p className="text-gray-500 text-sm">All-time stats</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/3 border border-white/8 rounded-xl p-5">
          <p className="text-gray-500 text-xs tracking-widest mb-2">BEST REACTION</p>
          {stats.bestTime !== null ? (
            <p className="text-purple-400 text-4xl font-black">
              {stats.bestTime}
              <span className="text-gray-500 text-sm font-normal">ms</span>
            </p>
          ) : (
            <p className="text-gray-600 text-2xl font-black">—</p>
          )}
        </div>
        <div className="bg-white/3 border border-white/8 rounded-xl p-5">
          <p className="text-gray-500 text-xs tracking-widest mb-2">BEST STREAK</p>
          {stats.bestStreak !== null ? (
            <p className="text-cyan-400 text-4xl font-black">
              {stats.bestStreak}
              <span className="text-gray-500 text-sm font-normal"> dabs</span>
            </p>
          ) : (
            <p className="text-gray-600 text-2xl font-black">—</p>
          )}
        </div>
      </div>

      <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex items-center gap-3">
        <span className="text-2xl">🎮</span>
        <div>
          <p className="text-amber-400 text-xl font-bold">{stats.totalPlays}</p>
          <p className="text-gray-500 text-xs">Total Plays</p>
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
