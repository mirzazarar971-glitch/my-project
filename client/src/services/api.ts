import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 12_000,
  headers: { 'Content-Type': 'application/json' },
})

export function getApiError(error: unknown, fallback = 'The API request failed.') {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error
    return typeof message === 'string' ? message : error.message || fallback
  }
  return error instanceof Error ? error.message : fallback
}
