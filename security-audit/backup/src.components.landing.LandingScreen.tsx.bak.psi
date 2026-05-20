'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Zap, Flame } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import type { GameMode } from '@/types'
import { useRealtimeVersion } from '@/hooks/useRealtimeVersion'
import ProfileCard from './ProfileCard'
import UsernameSetupModal from './UsernameSetupModal'

interface Props {
  onStart: (mode: GameMode) => void
}

const MODES = [
  {
    id: 'single' as GameMode,
    icon: Zap,
    label: 'Reflex Dab',
    sub: 'Fastest reaction wins',
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-400/10',
    accentBorder: 'border-yellow-400/60',
    accentBg: 'bg-yellow-400/8',
  },
  {
    id: 'streak' as GameMode,
    icon: Flame,
    label: 'Dab Rush',
    sub: '30s — dab as many times as you can',
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-400/10',
    accentBorder: 'border-orange-400/60',
    accentBg: 'bg-orange-400/8',
  },
] as const

function formatPlays(n: number): string {
  return n.toLocaleString('en-US')
}

export default function LandingScreen({ onStart }: Props) {
  const [selectedMode, setSelectedMode] = useState<GameMode>('single')
  const [totalPlays, setTotalPlays] = useState<number | null>(null)
  const [totalDabs, setTotalDabs] = useState<number | null>(null)
  const statsRef = useRef<(() => void) | null>(null)
  const { data: session } = useSession()

  useEffect(() => {
    const doFetch = () =>
      fetch('/api/stats', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return
          if (typeof d.totalPlays === 'number') setTotalPlays(d.totalPlays)
          if (typeof d.totalDabs === 'number') setTotalDabs(d.totalDabs)
        })
        .catch(() => {})
    statsRef.current = doFetch
    doFetch()
    const id = setInterval(doFetch, 30_000)
    return () => { clearInterval(id); statsRef.current = null }
  }, [])

  useRealtimeVersion(() => statsRef.current?.())

  return (
    <div className="relative text-center space-y-10 p-4 sm:p-8">
      {/* Username setup modal — shown on first Google sign-in */}
      {session?.user?.needsUsernameSetup && session.user.name && (
        <UsernameSetupModal initialUsername={session.user.name} />
      )}

      {/* Top-right card — profile when signed in, sign-in prompt when not */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="fixed top-4 right-4 z-30"
      >
        {session?.user?.name && !session.user.needsUsernameSetup ? (
          <ProfileCard username={session.user.name} avatarUrl={session.user.image} />
        ) : !session?.user && (
          <Link href="/login" className="group block">
            <div className="flex flex-col items-center gap-1.5 bg-black/80 backdrop-blur-sm border border-white/10 group-hover:border-purple-500/40 group-hover:shadow-[0_0_16px_rgba(168,85,247,0.15)] rounded-2xl px-2.5 py-2.5 sm:px-3 sm:py-3 w-[76px] sm:w-[88px] transition-all duration-200">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 group-hover:text-purple-400 text-xl shrink-0 transition-colors">
                👤
              </div>
              <p className="text-white text-xs font-bold leading-tight text-center">Sign in</p>
              <p className="text-gray-500 text-[10px] leading-tight text-center">Track dabs</p>
            </div>
          </Link>
        )}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-3"
      >
        <h1 className="text-6xl sm:text-8xl font-black tracking-tight leading-none">
          <span className="text-white">DAB</span>
          <span className="text-purple-400"> POSE</span>
        </h1>
        <p className="text-gray-400 text-lg sm:text-2xl font-medium">How fast can you dab?</p>
        {totalPlays !== null && totalPlays > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center pt-1"
          >
            <span className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3.5 py-1.5 text-gray-300 text-xs sm:text-sm font-semibold tracking-wider">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              {formatPlays(totalPlays)} PLAYS
              {totalDabs !== null && totalDabs > 0 && <span className="text-gray-500">· {formatPlays(totalDabs)} DABS</span>}
            </span>
          </motion.div>
        )}
      </motion.div>

      {/* Mode selector — compact icon-top on mobile, horizontal on sm+ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg mx-auto"
      >
        {MODES.map(({ id, icon: Icon, label, sub, iconColor, iconBg, accentBorder, accentBg }) => {
          const selected = selectedMode === id
          return (
            <motion.button
              key={id}
              onClick={() => setSelectedMode(id)}
              whileTap={{ scale: 0.97 }}
              className={`border rounded-2xl px-3 py-4 sm:px-5 sm:py-5 text-center sm:text-left cursor-pointer transition-all duration-200 ${
                selected
                  ? `${accentBorder} ${accentBg}`
                  : 'border-white/10 bg-white/5 hover:bg-white/8'
              }`}
            >
              <div className="flex flex-col items-center sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <motion.div
                  className={`w-12 h-12 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${iconBg}`}
                  animate={selected && id === 'streak'
                    ? { scale: [1, 1.15, 1] }
                    : selected && id === 'single'
                    ? { rotate: [0, 12, -6, 0] }
                    : {}}
                  transition={{ repeat: Infinity, duration: id === 'streak' ? 1.2 : 2, ease: 'easeInOut' }}
                >
                  <Icon className={`w-6 h-6 ${iconColor}`} strokeWidth={2.5} />
                </motion.div>
                <div className="flex flex-col items-center sm:items-start">
                  <p className="text-white font-bold text-sm sm:text-base leading-tight">{label}</p>
                  {selected && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.25 }}
                      className={`h-0.5 mt-1 rounded-full ${id === 'single' ? 'bg-yellow-400' : 'bg-orange-400'} w-full max-w-[80px] sm:max-w-none`}
                    />
                  )}
                </div>
              </div>
              <p className="text-gray-400 text-xs sm:text-sm leading-snug">{sub}</p>
            </motion.button>
          )
        })}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onStart(selectedMode)}
        className="bg-purple-600 hover:bg-purple-500 text-white font-black text-2xl sm:text-3xl px-16 py-5 rounded-2xl neon-pulse cursor-pointer w-full max-w-lg"
      >
        Let&apos;s Go 🙌
      </motion.button>

      <motion.a
        href="/leaderboard"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="inline-flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-purple-500/40 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all duration-200 cursor-pointer w-full max-w-lg justify-center"
      >
        <span className="text-xl">👑</span>
        <span>Leaderboard</span>
        <span className="text-gray-500 text-sm font-normal">Top Dabbers →</span>
      </motion.a>

      {/* Privacy notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
        className="max-w-lg mx-auto"
      >
        <Link
          href="/privacy"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-xs transition-colors"
        >
          <span>🔒</span>
          <span>Camera stays on your device — no video recorded or uploaded</span>
        </Link>
      </motion.div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-xs text-gray-600 flex justify-center gap-4 pb-2"
      >
        <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
        <span>·</span>
        <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy</Link>
      </motion.footer>
    </div>
  )
}
