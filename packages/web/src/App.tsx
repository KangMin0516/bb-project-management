import { useEffect, Suspense } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { useThemeStore } from '@/stores/theme'
import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'
import ErrorBoundary from '@/shared/ui/ErrorBoundary'
import ImagePreviewModal from '@/shared/ui/atoms/ImagePreviewModal'
import { Toaster } from 'sonner'

export default function App() {
  useEffect(() => {
    useThemeStore.getState().initTheme()
  }, [])

  return (
    <AppProviders>
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={
            <div className="flex h-screen items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
            </div>
          }>
            <AppRouter />
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
      <Toaster position="bottom-right" richColors />
      <ImagePreviewModal />
    </AppProviders>
  )
}
