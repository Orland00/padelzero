import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CrownBadge from '@/components/CrownBadge'

export default function CrownCelebration({ playerName, isVisible, onComplete }) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onComplete, 4000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onComplete])

  // Confetti particles
  const confetti = Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 2 + Math.random() * 1,
  }))

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
        >
          {/* Confetti */}
          {confetti.map(particle => (
            <motion.div
              key={particle.id}
              initial={{
                left: `${particle.x}%`,
                top: -20,
                opacity: 1,
              }}
              animate={{
                top: '100vh',
                opacity: 0,
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                ease: 'easeIn',
              }}
              className="absolute w-2 h-2 bg-amber-400 rounded-full"
            />
          ))}

          {/* Crown and Message */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="flex flex-col items-center gap-6"
          >
            <motion.div
              animate={{
                y: [0, -20, 0],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <CrownBadge size="xl" animate={false} />
            </motion.div>

            <div className="text-center">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-black text-amber-300 mb-2 drop-shadow-lg"
              >
                ¡NUEVA CORONA!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-2xl font-bold text-white drop-shadow-lg"
              >
                {playerName}
              </motion.p>
            </div>

            {/* Pulse rings */}
            {[1, 2, 3].map(i => (
              <motion.div
                key={i}
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{
                  duration: 1.5,
                  delay: i * 0.2,
                  repeat: Infinity,
                }}
                className="absolute w-32 h-32 border-2 border-amber-400 rounded-full"
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
