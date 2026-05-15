import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
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
    .where(eq(users.id, session.user.id))
    .limit(1)
  if (!user) {
    redirect('/login')
  }
  redirect(`/profile/${user.username}`)
}
