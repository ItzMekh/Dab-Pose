import Link from 'next/link'
import type { Score } from '@/types'

export default function UserCell({
  score,
  colorClass,
}: {
  score: Score
  colorClass: string
}) {
  const body = (
    <span className="inline-flex items-center gap-2 min-w-0">
      {score.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={score.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="w-5 h-5 rounded-full shrink-0 border border-white/10"
        />
      ) : (
        <span className="w-5 h-5 rounded-full shrink-0 bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 text-[10px]">
          {score.username.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="max-w-[140px] sm:max-w-none truncate">{score.username}</span>
      {score.verified && (
        <span
          title="Verified account"
          aria-label="Verified account"
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 text-[10px] shrink-0"
        >
          ✓
        </span>
      )}
    </span>
  )

  if (score.verified) {
    return (
      <Link
        href={`/profile/${score.username}`}
        prefetch={false}
        className={`${colorClass} transition-colors`}
      >
        {body}
      </Link>
    )
  }

  return <span className={`${colorClass.split(' ')[0]} opacity-90`} title="Anonymous player">{body}</span>
}
