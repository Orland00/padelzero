export const THEMES = {
  default: {
    id: 'default',
    primary: '#10b981', // emerald-500
    bgGradient: 'from-emerald-500/10 to-transparent',
    tabActive: 'bg-emerald-500 text-white',
    tabInactive: 'text-zinc-500',
    accent: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-400',
  },
  proleague: {
    id: 'proleague',
    primary: '#6b2f9d', // purple
    secondary: '#3273dc', // blue
    accent: '#25d366', // green
    bgGradient: 'from-[#6b2f9d]/20 to-[#3273dc]/10',
    tabActive: 'bg-[#6b2f9d] text-white',
    tabInactive: 'text-zinc-500',
    accentText: 'text-[#25d366]',
    badge: 'bg-[#25d366]/20 text-[#25d366]',
    icon: '💧',
  },
  manada: {
    id: 'manada',
    primary: '#ffffff',
    bgGradient: 'from-zinc-900 to-black',
    tabActive: 'bg-white text-black',
    tabInactive: 'text-zinc-600',
    accentText: 'text-white',
    badge: 'bg-white text-black',
    icon: '🐺',
  }
}

export function getTheme(name = '') {
  const n = name.toLowerCase()
  if (n.includes('proleague')) return THEMES.proleague
  if (n.includes('manada')) return THEMES.manada
  return THEMES.default
}
