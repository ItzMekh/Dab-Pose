import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Stats — Dab Pose',
  description: 'Live game statistics for Dab Pose',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {children}
    </main>
  )
}
