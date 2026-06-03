import { useEffect } from 'react'
import { create } from 'zustand'

export const useHeaderStore = create((set) => ({
  title: '',
  setTitle: (title) => set({ title }),
}))

export function usePageTitle(title) {
  const setTitle = useHeaderStore((s) => s.setTitle)
  useEffect(() => {
    setTitle(title)
    document.title = title ? `${title} — padelzero.win` : 'padelzero.win'
    return () => {
      setTitle('')
      document.title = 'padelzero.win'
    }
  }, [title, setTitle])
}
