import { create } from 'zustand'

let toastId = 0

export const useUiStore = create((set) => ({
  toasts: [],
  modals: [],
  confirmDialog: null,
  globalLoading: false,

  showToast: ({ type = 'info', message, duration = 3000 }) => {
    const id = toastId++
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }))

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }

    return id
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  dismissAllToasts: () => {
    set({ toasts: [] })
  },

  showModal: ({ component, props = {} }) => {
    set((state) => ({
      modals: [...state.modals, { component, props }],
    }))
  },

  dismissModal: () => {
    set((state) => ({
      modals: state.modals.slice(0, -1),
    }))
  },

  setGlobalLoading: (loading) => {
    set({ globalLoading: loading })
  },

  // Promise-based replacement for window.confirm() — branded dialog that
  // doesn't block iOS PWA webviews. Returns Promise<boolean>.
  // Usage: const ok = await useUiStore.getState().confirm({ message: '...' })
  confirm: ({ title, message, confirmText, cancelText, danger = false } = {}) => {
    return new Promise((resolve) => {
      set({
        confirmDialog: {
          title: title || null,
          message: message || '',
          confirmText: confirmText || null,
          cancelText: cancelText || null,
          danger,
          onConfirm: () => {
            set({ confirmDialog: null })
            resolve(true)
          },
          onCancel: () => {
            set({ confirmDialog: null })
            resolve(false)
          },
        },
      })
    })
  },
}))
