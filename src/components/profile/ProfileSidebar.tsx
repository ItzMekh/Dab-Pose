import Link from 'next/link'
import type { User } from '@/lib/schema'

const COUNTRY_NAMES: Record<string, string> = {
  TH: '🇹🇭 Thailand', US: '🇺🇸 United States', JP: '🇯🇵 Japan',
  GB: '🇬🇧 United Kingdom', DE: '🇩🇪 Germany', FR: '🇫🇷 France',
  KR: '🇰🇷 South Korea', CN: '🇨🇳 China', AU: '🇦🇺 Australia',
  CA: '🇨🇦 Canada', BR: '🇧🇷 Brazil', IN: '🇮🇳 India',
  SG: '🇸🇬 Singapore', MX: '🇲🇽 Mexico', IT: '🇮🇹 Italy',
  XX: '🌍 Global',
}

function countryLabel(code: string): string {
  return COUNTRY_NAMES[code] ?? `🌍 ${code}`
}

function LetterAvatar({ username }: { username: string }) {
  const colors = [
    'from-purple-500 to-indigo-500',
    'from-cyan-500 to-blue-500',
    'from-pink-500 to-rose-500',
    'from-amber-500 to-orange-500',
    'from-emerald-500 to-teal-500',
  ]
  const idx = username.charCodeAt(0) % colors.length
  return (
    <div
      className={`w-14 h-14 rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white font-black text-2xl mx-auto`}
    >
      {username[0].toUpperCase()}
    </div>
  )
}

const TABS = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'history',  label: '📋 History' },
  { id: 'settings', label: '⚙️ Settings' },
]

interface Props {
  user: Pick<User, 'username' | 'avatarUrl' | 'country' | 'createdAt'>
  activeTab: string
  isOwner: boolean
}

export default function ProfileSidebar({ user, activeTab, isOwner }: Props) {
  const joinedMonth = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  const visibleTabs = TABS.filter(({ id }) => !(id === 'settings' && !isOwner))

  return (
    <>
      {/* Mobile top bar */}
      <div className="sm:hidden bg-[#0a0a0a] border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.username} className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10 shrink-0" />
          ) : (
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-black text-base shrink-0`}>
              {user.username[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold truncate">{user.username}</p>
            <p className="text-gray-500 text-xs">{countryLabel(user.country)}</p>
          </div>
          <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white text-xs font-medium transition-all">
            <span>🏠</span>
            <span>Home</span>
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-0.5">
          {visibleTabs.map(({ id, label }) => {
            const active = activeTab === id
            return (
              <Link
                key={id}
                href={`/profile/${user.username}${id === 'overview' ? '' : `?tab=${id}`}`}
                className={`text-xs px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                  active ? 'bg-purple-600 text-white font-bold' : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden sm:flex w-52 shrink-0 bg-[#0a0a0a] border-r border-white/5 flex-col gap-5 p-5 min-h-screen">
        <div className="text-center space-y-2 pt-3">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-16 h-16 rounded-full mx-auto object-cover ring-2 ring-white/10"
            />
          ) : (
            <LetterAvatar username={user.username} />
          )}
          <p className="text-white text-base font-bold truncate">{user.username}</p>
          <p className="text-gray-500 text-xs">{countryLabel(user.country)}</p>
        </div>

        <nav className="flex flex-col gap-1.5">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all text-gray-400 hover:text-white bg-white/3 hover:bg-white/8 border border-white/5 hover:border-white/10 text-sm font-medium"
          >
            <span>🏠</span>
            <span>Home</span>
          </Link>
          <div className="border-t border-white/5 my-1" />
          {visibleTabs.map(({ id, label }) => {
            const active = activeTab === id
            return (
              <Link
                key={id}
                href={`/profile/${user.username}${id === 'overview' ? '' : `?tab=${id}`}`}
                className={`text-sm px-3 py-2.5 rounded-xl transition-all ${
                  active
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {joinedMonth && (
          <p className="mt-auto text-center text-gray-600 text-xs pb-2">
            Joined {joinedMonth}
          </p>
        )}
      </aside>
    </>
  )
}
