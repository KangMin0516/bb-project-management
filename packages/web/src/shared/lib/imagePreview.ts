import { create } from 'zustand'

interface ImagePreviewState {
  url: string | null
  alt: string
  open: (url: string, alt?: string) => void
  close: () => void
}

export const useImagePreviewStore = create<ImagePreviewState>((set) => ({
  url: null,
  alt: '',
  open: (url, alt = '') => set({ url, alt }),
  close: () => set({ url: null, alt: '' }),
}))
