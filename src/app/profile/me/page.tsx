import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { eq, and, isNull } from 'drizzle-orm'
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
    .where(and(eq(users.id, session.user.id), isNull(users.deletedAt)))
    .limit(1)
  if (!user) {
    const cookieStore = await cookies()
    cookieStore.delete('authjs.session-token')
    cookieStore.delete('__Secure-authjs.session-token')
    redirect('/login')
  }
  redirect(`/profile/${user.username}`)
}
