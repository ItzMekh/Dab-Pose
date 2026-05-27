import { redirect } from 'next/navigation'
import { eq, and, isNull } from 'drizzle-orm'
import { auth, signOut } from '@/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'

export default async function ProfileMePage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }
  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(and(eq(users.id, session.user.id), isNull(users.deletedAt)))
    .limit(1)
  if (!user) {
    await signOut({ redirect: false })
    redirect('/login')
  }
  redirect(`/profile/${user.username}`)
}
