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

  return (
    <aside className="w-44 shrink-0 bg-[#0a0a0a] border-r border-white/5 flex flex-col gap-4 p-4 min-h-screen">
      <div className="text-center space-y-1 pt-2">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-14 h-14 rounded-full mx-auto object-cover"
          />
        ) : (
          <LetterAvatar username={user.username} />
        )}
        <p className="text-white text-sm font-bold truncate">{user.username}</p>
        <p className="text-gray-500 text-xs">{countryLabel(user.country)}</p>
      </div>

      <nav className="flex flex-col gap-1">
        {TABS.map(({ id, label }) => {
          if (id === 'settings' && !isOwner) return null
          const active = activeTab === id
          return (
            <Link
              key={id}
              href={`/profile/${user.username}${id === 'overview' ? '' : `?tab=${id}`}`}
              className={`text-xs px-3 py-2 rounded-lg transition-colors ${
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
        <p className="mt-auto text-center text-gray-700 text-xs pb-2">
          Joined {joinedMonth}
        </p>
      )}
    </aside>
  )
}
