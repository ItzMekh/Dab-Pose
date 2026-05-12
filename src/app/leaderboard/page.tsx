import Leaderboard from '@/components/leaderboard/Leaderboard'

export const metadata = { title: 'Leaderboard — Dabspeed' }

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-8">
      <Leaderboard />
    </main>
  )
}
