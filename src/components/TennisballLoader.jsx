import { motion } from 'framer-motion'

export default function TennisballLoader({ size = 'md', className = '' }) {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <motion.svg
        viewBox="0 0 100 100"
        className={sizeMap[size]}
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        {/* Tennis ball body - yellow */}
        <circle cx="50" cy="50" r="45" fill="#E5D600" />

        {/* Tennis ball curved seams - white lines */}
        <path
          d="M 50 5 Q 70 25 70 50 Q 70 75 50 95"
          stroke="white"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 50 5 Q 30 25 30 50 Q 30 75 50 95"
          stroke="white"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Subtle shine/highlight */}
        <ellipse cx="35" cy="25" rx="8" ry="6" fill="white" opacity="0.4" />
      </motion.svg>
    </div>
  )
}
