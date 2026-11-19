import { createHmac } from 'node:crypto'
import { HttpError } from './httpError.js'

const countryHeaders = new Set(['cf-ipcountry', 'x-vercel-ip-country'])
const campaignPattern = /^[\p{L}\p{N}._ -]+$/u

export function hashAnalyticsId(value) {
  const secret = process.env.ANALYTICS_HASH_SECRET || process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new HttpError(503, 'Analytics requires a stable server-side hashing secret of at least 32 characters.')
  }
  return createHmac('sha256', secret).update(`devtools-analytics-v1:${value}`).digest('hex')
}

export function getAnalyticsRetentionDays() {
  const value = Number.parseInt(process.env.ANALYTICS_RETENTION_DAYS ?? '180', 10)
  if (!Number.isInteger(value) || value < 30 || value > 730) {
    throw new HttpError(503, 'ANALYTICS_RETENTION_DAYS must be between 30 and 730.')
  }
  return value
}

export function getSessionTimeoutMinutes() {
  const value = Number.parseInt(process.env.ANALYTICS_SESSION_TIMEOUT_MINUTES ?? '30', 10)
  if (!Number.isInteger(value) || value < 5 || value > 120) {
    throw new HttpError(503, 'ANALYTICS_SESSION_TIMEOUT_MINUTES must be between 5 and 120.')
  }
  return value
}

export function getActiveWindowSeconds() {
  const value = Number.parseInt(process.env.ANALYTICS_ACTIVE_WINDOW_SECONDS ?? '60', 10)
  if (!Number.isInteger(value) || value < 30 || value > 180) {
    throw new HttpError(503, 'ANALYTICS_ACTIVE_WINDOW_SECONDS must be between 30 and 180.')
  }
  return value
}

export function getCountry(request) {
  const configuredHeader = process.env.ANALYTICS_COUNTRY_HEADER?.trim().toLowerCase()
  if (!configuredHeader || !countryHeaders.has(configuredHeader)) return undefined
  const country = request.get(configuredHeader)?.trim().toUpperCase()
  return country && /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : undefined
}

export function parseUserAgent(userAgent = '') {
  const browser = /\b(?:edg|edge)\//i.test(userAgent) ? 'Edge'
    : /\bopr\//i.test(userAgent) ? 'Opera'
      : /\bfirefox\//i.test(userAgent) ? 'Firefox'
        : /\b(?:chrome|crios)\//i.test(userAgent) ? 'Chrome'
          : /\b(?:safari|version)\//i.test(userAgent) ? 'Safari'
            : 'Other'
  const operatingSystem = /\b(?:iphone|ipad|ipod)\b/i.test(userAgent) ? 'iOS'
    : /\bandroid\b/i.test(userAgent) ? 'Android'
      : /\bwindows\b/i.test(userAgent) ? 'Windows'
        : /\bmacintosh|mac os\b/i.test(userAgent) ? 'macOS'
          : /\blinux\b/i.test(userAgent) ? 'Linux'
            : 'Other'
  const deviceCategory = /\bipad|tablet\b/i.test(userAgent) ? 'tablet'
    : /\b(?:mobile|iphone|ipod|android)\b/i.test(userAgent) ? 'mobile'
      : userAgent ? 'desktop' : 'unknown'
  return { browser, operatingSystem, deviceCategory }
}

export function normalizeCampaign(value) {
  if (!value) return undefined
  const clean = (candidate, maxLength) => {
    if (typeof candidate !== 'string') return undefined
    const trimmed = candidate.trim()
    return trimmed && trimmed.length <= maxLength && campaignPattern.test(trimmed)
      ? trimmed
      : undefined
  }
  const campaign = {
    source: clean(value.source, 80),
    medium: clean(value.medium, 80),
    name: clean(value.name, 120),
  }
  return Object.values(campaign).some(Boolean) ? campaign : undefined
}

export function normalizeReferrerHost(value) {
  if (!value) return undefined
  const host = value.toLowerCase()
  const ownHosts = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => {
      try {
        return new URL(origin.trim()).hostname.toLowerCase()
      } catch {
        return ''
      }
    })
  return ownHosts.includes(host) ? undefined : host
}

export function classifyTraffic(referrerHost, campaign) {
  if (campaign && Object.values(campaign).some(Boolean)) return 'campaign'
  if (!referrerHost) return 'direct'
  if (/(^|\.)((google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|brave)\.)/i.test(referrerHost)) return 'organic'
  if (/(^|\.)((facebook|instagram|tiktok|youtube|reddit|linkedin|twitter|x|pinterest|threads)\.)/i.test(referrerHost)) return 'social'
  return 'referral'
}

export function parseDateRange(query, now = new Date()) {
  const startValue = typeof query.startDate === 'string' ? query.startDate : ''
  const endValue = typeof query.endDate === 'string' ? query.endDate : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startValue) || !/^\d{4}-\d{2}-\d{2}$/.test(endValue)) {
    throw new HttpError(400, 'Provide startDate and endDate in YYYY-MM-DD format.')
  }
  const start = new Date(`${startValue}T00:00:00.000Z`)
  const end = new Date(`${endValue}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    || start.toISOString().slice(0, 10) !== startValue
    || end.toISOString().slice(0, 10) !== endValue
    || start > end
    || end > new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))) {
    throw new HttpError(400, 'The selected analytics date range is invalid.')
  }
  const endExclusive = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  if (endExclusive.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new HttpError(400, 'The selected analytics range cannot exceed 366 days.')
  }
  return { start, endExclusive, end }
}
