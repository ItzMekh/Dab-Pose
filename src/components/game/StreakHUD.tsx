'use client'

import { motion } from 'framer-motion'

interface Props {
  count: number
  timeLeft: number
}

export default function StreakHUD({ count, timeLeft }: Props) {
  const urgent = timeLeft <= 5
  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
      <div className="bg-black/60 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-3 text-center">
        <p className="text-gray-400 text-xs uppercase tracking-widest">Dabs</p>
        <motion.p
          key={count}
          initial={{ scale: 1.4 }}
          animate={{ scale: 1 }}
          className="text-4xl font-black text-white tabular-nums"
        >
          {count}
        </motion.p>
      </div>
      <div className={`bg-black/60 backdrop-blur-sm border rounded-2xl px-5 py-3 text-center transition-colors ${urgent ? 'border-red-500/60' : 'border-white/20'}`}>
        <p className="text-gray-400 text-xs uppercase tracking-widest">Time</p>
        <p className={`text-4xl font-black tabular-nums ${urgent ? 'text-red-400' : 'text-white'}`}>
          {timeLeft}s
        </p>
      </div>
    </div>
  )
}
