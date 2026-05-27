'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TermsContent from './TermsContent'
import PrivacyContent from './PrivacyContent'

interface LegalModalProps {
  type: 'terms' | 'privacy'
  onClose: () => void
  onSwitchTo: (type: 'terms' | 'privacy') => void
}

export default function LegalModal({ type, onClose, onSwitchTo }: LegalModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [type])

  const title = type === 'terms' ? 'Terms of Service' : 'Privacy Policy'

  return (
    <AnimatePresence>
      {/* Desktop: backdrop + centered card */}
      <motion.div
        className="hidden lg:flex fixed inset-0 z-50 items-center justify-center p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <motion.div
          className="relative bg-[#0f0f17] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
            <h3 className="text-lg font-extrabold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
            >
              &times;
            </button>
          </div>
          <div ref={scrollRef} className="px-6 py-6 overflow-y-auto flex-1 scrollbar-thin">
            {type === 'terms' ? <TermsContent onSwitchTo={onSwitchTo} /> : <PrivacyContent />}
          </div>
        </motion.div>
      </motion.div>

      {/* Mobile: fullscreen sheet */}
      <motion.div
        className="lg:hidden fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col overflow-hidden"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 min-h-[56px]">
          <h3 className="text-[17px] font-extrabold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center text-xl transition-colors"
          >
            &times;
          </button>
        </div>
        <div ref={scrollRef} className="px-5 py-5 overflow-y-auto flex-1 overscroll-contain scrollbar-thin">
          {type === 'terms' ? <TermsContent onSwitchTo={onSwitchTo} /> : <PrivacyContent />}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
