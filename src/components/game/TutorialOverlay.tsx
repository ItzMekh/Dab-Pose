'use client'

import { motion } from 'framer-motion'

const STEPS = [
  { icon: '↔️', text: 'Stand 1.5–2 m from camera — full body in frame' },
  { icon: '☀️', text: 'Face a light source — avoid sitting with a window behind you' },
  { icon: '📷', text: 'Allow camera access when prompted' },
  { icon: '🟢', text: 'Wait for the border to turn green' },
  { icon: '🙌', text: 'DAB as fast as you can!' },
  { icon: '⚡', text: 'Your reaction time shows in milliseconds' },
]

interface Props {
  onDismiss: () => void
}

export default function TutorialOverlay({ onDismiss }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-6 px-6"
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        className="w-full max-w-sm space-y-5"
      >
        <div className="text-center space-y-1">
          <p className="text-4xl">🙌</p>
          <h2 className="text-2xl font-black text-white tracking-tight">How to Play</h2>
        </div>

        <ul className="space-y-3">
          {STEPS.map((step, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex items-center gap-4 bg-white/8 border border-white/10 rounded-2xl px-4 py-3"
            >
              <span className="text-2xl flex-shrink-0">{step.icon}</span>
              <span className="text-white text-sm font-medium">{step.text}</span>
            </motion.li>
          ))}
        </ul>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: 0.96 }}
          onClick={onDismiss}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black text-lg py-4 rounded-2xl cursor-pointer transition-colors"
        >
          Got it — Let&apos;s Dab!
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
