import { fetchDashboardData } from '@/lib/dashboard'
import { DashboardClient } from './components/DashboardClient'

export const revalidate = 30

export default async function DashboardPage() {
  const data = await fetchDashboardData('all')
  return <DashboardClient initial={data} />
}
