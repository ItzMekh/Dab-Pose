import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users, scores } from '@/lib/schema'
import { eq, min, max, count } from 'drizzle-orm'
import ProfileSidebar from '@/components/profile/ProfileSidebar'
import OverviewTab from '@/components/profile/OverviewTab'
import HistoryTab from '@/components/profile/HistoryTab'
import SettingsTab from '@/components/profile/SettingsTab'

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params
  const { tab = 'overview' } = await searchParams

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) notFound()

  const session = await auth()
  const isOwner = !!session?.user?.id && session.user.id === user.id

  const [stats] = await db
    .select({
      bestTime: min(scores.timeMs),
      bestStreak: max(scores.count),
      totalPlays: count(),
    })
    .from(scores)
    .where(eq(scores.userId, user.id))

  const safeStats = stats ?? { bestTime: null, bestStreak: null, totalPlays: 0 }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col sm:flex-row">
      <ProfileSidebar user={user} activeTab={tab} isOwner={isOwner} />
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        {tab === 'overview' && <OverviewTab stats={safeStats} />}
        {tab === 'history' && <HistoryTab username={username} />}
        {tab === 'settings' && isOwner && (
          <SettingsTab
            username={user.username}
            country={user.country}
            hasPassword={!!user.passwordHash}
            usernameChangedAt={user.usernameChangedAt?.toISOString() ?? null}
          />
        )}
        {tab === 'settings' && !isOwner && (
          <p className="text-gray-600 text-sm">
            Settings are only visible to the account owner.
          </p>
        )}
      </main>
    </div>
  )
}
