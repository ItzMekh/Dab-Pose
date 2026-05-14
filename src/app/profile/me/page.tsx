import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export default async function ProfileMePage() {
  const session = await auth()
  if (!session?.user?.name) {
    redirect('/login')
  }
  redirect(`/profile/${session.user.name}`)
}
