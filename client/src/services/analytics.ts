import { categories, tools } from '../tools/catalog'

type EventIdentity = { visitorId: string; sessionId: string }
type AnalyticsEvent =
  | (EventIdentity & { type: 'page_view'; eventId: string; path: string; referrerHost?: string; campaign?: { source?: string; medium?: string; name?: string } })
  | (EventIdentity & { type: 'page_engagement'; eventId: string; path: string; durationMs: number })
  | (EventIdentity & { type: 'tool_click'; eventId: string; path: string; toolSlug: string })
  | (EventIdentity & { type: 'tool_execution'; eventId: string; path: string; toolSlug: string; success: boolean; durationMs: number })
  | (EventIdentity & { type: 'search'; eventId: string; path: string; queryLength: number; resultCount: number })
  | (EventIdentity & { type: 'heartbeat'; path?: string })

const endpoint = '/api/analytics/events'
const publicPaths = new Set(['/', '/tools', '/profile', '/privacy-policy', '/terms-of-service', '/disclaimer', '/contact', ...tools.map((tool) => `/tools/${tool.slug}`), ...categories.map((category) => `/category/${encodeURIComponent(category)}`)])
const queue: AnalyticsEvent[] = []
let scheduledFlush: number | undefined
let fallbackVisitorId = ''
let fallbackSessionId = ''
let lastPageViewKey = ''
let warnedAboutFailure = false

function randomId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function storedId(storage: Storage, key: string, fallback: string) {
  try {
    const stored = storage.getItem(key)
    if (stored) return stored
    const created = randomId()
    storage.setItem(key, created)
    return created
  } catch {
    return fallback || randomId()
  }
}

function getIdentity() {
  fallbackVisitorId ||= randomId()
  fallbackSessionId ||= randomId()
  try {
    return {
      visitorId: storedId(window.localStorage, 'devtools_analytics_visitor', fallbackVisitorId),
      sessionId: storedId(window.sessionStorage, 'devtools_analytics_session', fallbackSessionId),
    }
  } catch {
    return { visitorId: fallbackVisitorId, sessionId: fallbackSessionId }
  }
}

function enqueue(event: AnalyticsEvent) {
  if (queue.length >= 100) queue.shift()
  queue.push(event)
  if (scheduledFlush !== undefined) window.clearTimeout(scheduledFlush)
  scheduledFlush = window.setTimeout(() => { void flush() }, 800)
}

export function trackPageView(path: string, search: string) {
  if (!publicPaths.has(path)) return
  const identity = getIdentity()
  const { sessionId } = identity
  const key = `${sessionId}:${path}`
  if (lastPageViewKey === key) return
  lastPageViewKey = key
  const params = new URLSearchParams(search)
  let referrerHost: string | undefined
  try {
    referrerHost = document.referrer ? new URL(document.referrer).hostname : undefined
  } catch {
    referrerHost = undefined
  }
  const campaign = {
    source: params.get('utm_source')?.slice(0, 80) ?? undefined,
    medium: params.get('utm_medium')?.slice(0, 80) ?? undefined,
    name: params.get('utm_campaign')?.slice(0, 120) ?? undefined,
  }
  enqueue({
    ...identity,
    type: 'page_view',
    eventId: randomId(),
    path,
    ...(referrerHost ? { referrerHost } : {}),
    ...(Object.values(campaign).some(Boolean) ? { campaign } : {}),
  })
}

export function trackHeartbeat(path: string) {
  if (!publicPaths.has(path)) return
  const { visitorId, sessionId } = getIdentity()
  enqueue({ visitorId, sessionId, type: 'heartbeat', path })
}

export function trackPageEngagement(path: string, durationMs: number) {
  if (durationMs < 1000 || !publicPaths.has(path)) return
  const { visitorId, sessionId } = getIdentity()
  enqueue({ visitorId, sessionId, eventId: randomId(), type: 'page_engagement', path, durationMs: Math.min(Math.round(durationMs), 1_800_000) })
}

export function trackToolClick(toolSlug: string, path: string) {
  if (!publicPaths.has(path)) return
  const { visitorId, sessionId } = getIdentity()
  enqueue({ visitorId, sessionId, eventId: randomId(), type: 'tool_click', path, toolSlug })
}

export function trackToolExecution(toolSlug: string, path: string, success: boolean, durationMs: number) {
  if (!publicPaths.has(path)) return
  const { visitorId, sessionId } = getIdentity()
  enqueue({
    visitorId,
    sessionId,
    eventId: randomId(),
    type: 'tool_execution',
    path,
    toolSlug,
    success,
    durationMs: Math.min(Math.max(0, Math.round(durationMs)), 1_800_000),
  })
}

export function trackSearch(path: string, queryLength: number, resultCount: number) {
  if (!publicPaths.has(path)) return
  const { visitorId, sessionId } = getIdentity()
  enqueue({
    visitorId,
    sessionId,
    eventId: randomId(),
    type: 'search',
    path,
    queryLength: Math.min(Math.max(0, Math.round(queryLength)), 200),
    resultCount: Math.min(Math.max(0, Math.round(resultCount)), 100),
  })
}

export function flushAnalyticsOnPageExit() {
  if (!queue.length) return
  const pending = queue.splice(0, queue.length)
  for (let index = 0; index < pending.length; index += 20) {
    const body = JSON.stringify({ events: pending.slice(index, index + 20) })
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon?.(endpoint, blob)) continue
    void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
      .catch(reportDeliveryFailure)
  }
}

async function flush() {
  scheduledFlush = undefined
  if (!queue.length) return
  const events = queue.splice(0, 20)
  const remaining = queue.length > 0
  const { visitorId, sessionId } = getIdentity()
  const payload = { events: events.map((event) => ({ ...event, visitorId, sessionId })) }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
    if (!response.ok) reportDeliveryFailure(new Error(`Analytics endpoint returned ${response.status}.`))
  } catch (error) {
    reportDeliveryFailure(error)
  }
  if (remaining || queue.length) scheduledFlush = window.setTimeout(() => { void flush() }, 800)
}

function reportDeliveryFailure(error: unknown) {
  if (warnedAboutFailure) return
  warnedAboutFailure = true
  console.warn('Analytics could not be delivered; public tools remain available.', error)
}
