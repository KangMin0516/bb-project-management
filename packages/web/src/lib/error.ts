import { AxiosError } from 'axios'

export function getErrorMessage(err: unknown, fallback = 'An error occurred'): string {
  if (err instanceof AxiosError) {
    const msg = err.response?.data?.message
    if (typeof msg === 'string') return msg
    if (Array.isArray(msg) && msg.length > 0) return msg[0]
  }
  if (err instanceof Error) return err.message
  return fallback
}
