import { auth } from '@/auth'

const ADMIN_ID = process.env.ADMIN_USER_ID

export async function isAdmin(): Promise<{ admin: boolean; userId: string | null }> {
  if (!ADMIN_ID) return { admin: false, userId: null }
  const session = await auth()
  const userId = session?.user?.id ?? null
  return { admin: userId === ADMIN_ID, userId }
}
