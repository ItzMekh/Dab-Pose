import Link from 'next/link'

export default function ProfileNotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
      <p className="text-6xl font-black text-gray-700">404</p>
      <p className="text-gray-400">Player not found</p>
      <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm transition-colors">
        ← Back to home
      </Link>
    </div>
  )
}
