import { create } from 'zustand'

interface Toast {
  id: number
  message: string
  type: 'error' | 'success'
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type?: 'error' | 'success') => void
  removeToast: (id: number) => void
}

let nextId = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = 'error') => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })), 4000)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
