import { motion } from 'framer-motion'

export default function CrownBadge({ size = 'md', animate = true }) {
  const sizeMap = {
    sm: { w: 20, h: 16 },
    md: { w: 28, h: 22 },
    lg: { w: 44, h: 34 },
    xl: { w: 72, h: 56 },
  }

  const { w, h } = sizeMap[size] || sizeMap.md

  const Crown = (
    <svg
      width={w}
      height={h}
      viewBox="0 0 32 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Gold body gradient — dark bottom, bright middle, light top */}
        <linearGradient id="goldBody" x1="16" y1="2" x2="16" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFF176" />
          <stop offset="35%"  stopColor="#FFD600" />
          <stop offset="100%" stopColor="#A0720A" />
        </linearGradient>

        {/* Gold rim gradient */}
        <linearGradient id="goldRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FFE566" />
          <stop offset="100%" stopColor="#8B6208" />
        </linearGradient>

        {/* Diamond gem gradient */}
        <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#E8F8FF" />
          <stop offset="45%"  stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>

        {/* Outer glow filter */}
        <filter id="crownGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gem glow */}
        <filter id="gemGlow" x="-80%" y="-80%" width="360%" height="360%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Halo glow behind crown ── */}
      <path
        d="M2 25 L2 15 L8 7 L13 15 L16 2 L19 15 L24 7 L30 15 L30 25 Z"
        fill="#FFD600"
        opacity="0.25"
        filter="url(#crownGlow)"
      />

      {/* ── Crown body ── */}
      <path
        d="M2 25 L2 15 L8 7 L13 15 L16 2 L19 15 L24 7 L30 15 L30 25 Z"
        fill="url(#goldBody)"
        stroke="#7A5200"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />

      {/* ── Edge highlight (left slope of each prong) ── */}
      <path d="M2.5 15 L8 7.5"   stroke="#FFF59D" strokeWidth="0.9" strokeLinecap="round" opacity="0.9" />
      <path d="M13.5 15 L16 2.5" stroke="#FFF59D" strokeWidth="0.9" strokeLinecap="round" opacity="0.9" />
      <path d="M24 7.5 L29.5 15" stroke="#FFF59D" strokeWidth="0.9" strokeLinecap="round" opacity="0.9" />

      {/* ── Base rim ── */}
      <rect x="2" y="21" width="28" height="4" rx="1.5"
        fill="url(#goldRim)" stroke="#7A5200" strokeWidth="0.5" />
      {/* Rim shine */}
      <rect x="3" y="21.5" width="26" height="1.2" rx="0.6" fill="#FFE566" opacity="0.6" />

      {/* ── Side prong tips — small diamonds ── */}
      <polygon points="8,4.5 9.8,7 8,9 6.2,7" fill="#FFE566" stroke="#7A5200" strokeWidth="0.4" />
      <polygon points="8,4.5 9.8,7 8,9 6.2,7" fill="none" stroke="#FFF9C4" strokeWidth="0.3" opacity="0.8" />
      <polygon points="24,4.5 25.8,7 24,9 22.2,7" fill="#FFE566" stroke="#7A5200" strokeWidth="0.4" />
      <polygon points="24,4.5 25.8,7 24,9 22.2,7" fill="none" stroke="#FFF9C4" strokeWidth="0.3" opacity="0.8" />

      {/* ── Center ice-blue diamond gem ── */}
      <polygon
        points="16,7.5 19.5,11.5 16,15.5 12.5,11.5"
        fill="url(#gem)"
        stroke="#0369A1"
        strokeWidth="0.5"
        filter="url(#gemGlow)"
      />
      {/* Gem facet lines */}
      <line x1="16" y1="7.5" x2="16" y2="15.5" stroke="#E0F7FF" strokeWidth="0.4" opacity="0.6" />
      <line x1="12.5" y1="11.5" x2="19.5" y2="11.5" stroke="#E0F7FF" strokeWidth="0.4" opacity="0.6" />
      {/* Gem inner highlight */}
      <polygon points="16,8.2 18,11 16,10" fill="white" opacity="0.55" />
    </svg>
  )

  if (!animate) return Crown

  return (
    <motion.div
      animate={{
        y: [0, -3, 0],
        filter: [
          'drop-shadow(0 0 3px rgba(255,214,0,0.6))',
          'drop-shadow(0 0 8px rgba(255,214,0,0.95))',
          'drop-shadow(0 0 3px rgba(255,214,0,0.6))',
        ],
      }}
      transition={{
        duration: 2.4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {Crown}
    </motion.div>
  )
}
