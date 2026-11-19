import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { flushAnalyticsOnPageExit, trackHeartbeat, trackPageEngagement, trackPageView } from '../services/analytics'

export default function AnalyticsTracker() {
  const { pathname, search } = useLocation()
  const { user, status } = useAuth()
  const startedAt = useRef(0)
  const trackedPath = useRef('')

  useEffect(() => {
    if (status === 'loading' || user?.role === 'admin' || pathname.startsWith('/admin')) return
    const isNewPage = trackedPath.current !== pathname
    if (isNewPage) {
      if (trackedPath.current && startedAt.current && document.visibilityState === 'visible') {
        trackPageEngagement(trackedPath.current, performance.now() - startedAt.current)
      }
      trackedPath.current = pathname
      startedAt.current = performance.now()
      trackPageView(pathname, search)
    }

    const sendHeartbeat = () => {
      if (document.visibilityState === 'visible') trackHeartbeat(pathname)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        trackPageEngagement(pathname, performance.now() - startedAt.current)
        startedAt.current = 0
        flushAnalyticsOnPageExit()
      } else {
        startedAt.current = performance.now()
        sendHeartbeat()
      }
    }
    const handlePageHide = () => {
      if (startedAt.current && document.visibilityState === 'visible') {
        trackPageEngagement(pathname, performance.now() - startedAt.current)
        startedAt.current = 0
      }
      flushAnalyticsOnPageExit()
    }
    sendHeartbeat()
    const heartbeat = window.setInterval(sendHeartbeat, 25_000)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [pathname, search, status, user?.role])

  return null
}
