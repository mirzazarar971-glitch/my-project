import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import AnalyticsEvent from '../models/AnalyticsEvent.js'
import AnalyticsSession from '../models/AnalyticsSession.js'
import SearchConsoleCredential from '../models/SearchConsoleCredential.js'
import SearchConsoleOAuthState from '../models/SearchConsoleOAuthState.js'
import Tool from '../models/Tool.js'
import User from '../models/User.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { requireDatabase } from '../middleware/database.js'
import { buildAnalyticsReport } from '../services/analyticsReports.js'
import {
  createAuthorizationUrl,
  decryptRefreshToken,
  encryptRefreshToken,
  exchangeAuthorizationCode,
  fetchSearchConsoleReport,
  getSearchConsoleConfig,
} from '../services/searchConsole.js'
import { getActiveWindowSeconds, getAnalyticsRetentionDays, getSessionTimeoutMinutes, parseDateRange } from '../utils/analytics.js'
import { HttpError } from '../utils/httpError.js'

const router = Router()
const toolStatusSchema = z.object({ isActive: z.boolean() }).strict()
const rangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  granularity: z.enum(['day', 'week', 'month']).optional(),
}).strict()

const stateCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/admin/search-console/callback',
  maxAge: 10 * 60 * 1000,
})

const stateHash = (value) => createHash('sha256').update(value).digest('hex')

function isSameState(first, second) {
  const firstBuffer = Buffer.from(first ?? '')
  const secondBuffer = Buffer.from(second ?? '')
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer)
}

function clientRedirectUrl(status) {
  const origin = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',')[0].trim()
  return new URL(`/admin?section=search&gsc=${encodeURIComponent(status)}`, origin).toString()
}

router.get('/search-console/callback', requireDatabase, async (request, response) => {
  response.clearCookie('gsc_oauth_state', stateCookieOptions())
  const state = typeof request.query.state === 'string' ? request.query.state : ''
  const cookieState = request.cookies?.gsc_oauth_state ?? ''
  const code = typeof request.query.code === 'string' ? request.query.code : ''
  if (!state || !isSameState(state, cookieState)) {
    throw new HttpError(400, 'Google Search Console authorization state is invalid or expired.')
  }
  if (typeof request.query.error === 'string') {
    return response.redirect(303, clientRedirectUrl('error'))
  }
  if (!code || code.length > 2048) throw new HttpError(400, 'Google Search Console did not return an authorization code.')

  const oauthState = await SearchConsoleOAuthState.findOneAndDelete({
    stateHash: stateHash(state),
    expiresAt: { $gt: new Date() },
  })
  if (!oauthState) throw new HttpError(400, 'Google Search Console authorization state is invalid or expired.')
  const administrator = await User.findById(oauthState.adminId).select('_id role')
  if (!administrator || administrator.role !== 'admin') {
    throw new HttpError(403, 'The administrator who started this connection is no longer authorized.')
  }
  const config = getSearchConsoleConfig()
  if (!config.configured) {
    throw new HttpError(503, 'Google Search Console is not configured on this server.')
  }
  const tokens = await exchangeAuthorizationCode(code)
  const existing = await SearchConsoleCredential.findById('primary')
  const refreshToken = typeof tokens.refresh_token === 'string'
    ? tokens.refresh_token
    : existing
      ? decryptRefreshToken(existing.encryptedRefreshToken)
      : ''
  if (!refreshToken) {
    throw new HttpError(502, 'Google did not provide a refresh token. Revoke this app in Google Account permissions and reconnect.')
  }
  await SearchConsoleCredential.findOneAndUpdate({ _id: 'primary' }, {
    $set: {
      propertyUrl: config.propertyUrl,
      encryptedRefreshToken: encryptRefreshToken(refreshToken),
      connectedAt: new Date(),
      connectedBy: administrator._id,
    },
  }, { upsert: true, new: true, runValidators: true })
  return response.redirect(303, clientRedirectUrl('connected'))
})

router.use(requireAuth, requireAdmin, requireDatabase)

router.get('/analytics', async (request, response) => {
  const parsed = rangeSchema.safeParse(request.query)
  if (!parsed.success) throw new HttpError(400, 'Provide a valid analytics date range.', parsed.error.flatten())
  const range = parseDateRange(parsed.data)
  const report = await buildAnalyticsReport({
    ...range,
    granularity: parsed.data.granularity ?? 'day',
  })
  response.json(report)
})

router.get('/settings', async (_request, response) => {
  response.json({
    retentionDays: getAnalyticsRetentionDays(),
    sessionTimeoutMinutes: getSessionTimeoutMinutes(),
    activeWindowSeconds: getActiveWindowSeconds(),
    countryConfigured: ['cf-ipcountry', 'x-vercel-ip-country'].includes(process.env.ANALYTICS_COUNTRY_HEADER?.trim().toLowerCase()),
    googleSearchConsoleConfigured: getSearchConsoleConfig().configured,
  })
})

router.get('/search-console/status', async (_request, response) => {
  const [config, credential] = await Promise.all([
    Promise.resolve(getSearchConsoleConfig()),
    SearchConsoleCredential.findById('primary').select('propertyUrl connectedAt').lean(),
  ])
  response.json({
    configured: config.configured,
    connected: Boolean(credential),
    propertyUrl: credential?.propertyUrl ?? config.propertyUrl ?? null,
    connectedAt: credential?.connectedAt ?? null,
  })
})

router.post('/search-console/connect', async (request, response) => {
  const config = getSearchConsoleConfig()
  if (!config.configured) {
    throw new HttpError(503, 'Google Search Console is not configured. Set its OAuth credentials, redirect URI, property URL, and token encryption key.')
  }
  const state = randomBytes(32).toString('base64url')
  await SearchConsoleOAuthState.create({
    stateHash: stateHash(state),
    adminId: request.user._id,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  })
  response.cookie('gsc_oauth_state', state, stateCookieOptions())
  response.json({ authorizationUrl: createAuthorizationUrl(state) })
})

router.get('/search-console/report', async (request, response) => {
  const parsed = rangeSchema.pick({ startDate: true, endDate: true }).safeParse(request.query)
  if (!parsed.success) throw new HttpError(400, 'Provide a valid Search Console date range.')
  const range = parseDateRange(parsed.data)
  const credential = await SearchConsoleCredential.findById('primary')
  if (!getSearchConsoleConfig().configured) {
    throw new HttpError(503, 'Google Search Console is not configured on this server.')
  }
  if (!credential) throw new HttpError(409, 'Connect a Google Search Console property to view search performance.')
  const report = await fetchSearchConsoleReport(
    decryptRefreshToken(credential.encryptedRefreshToken),
    credential.propertyUrl,
    {
      startDate: range.start.toISOString().slice(0, 10),
      endDate: new Date(range.endExclusive.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    },
  )
  response.json({ propertyUrl: credential.propertyUrl, range: parsed.data, ...report })
})

router.delete('/search-console', async (_request, response) => {
  await SearchConsoleCredential.deleteOne({ _id: 'primary' })
  response.status(204).end()
})

router.get('/stats', async (_request, response) => {
  const [activeTools, totalTools, totalActivity] = await Promise.all([
    Tool.countDocuments({ isActive: true }),
    Tool.countDocuments(),
    AnalyticsEvent.countDocuments(),
  ])
  response.json({ stats: { activeTools, totalTools, totalActivity } })
})

router.get('/tools', async (request, response) => {
  const page = Math.max(1, Number.parseInt(String(request.query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(request.query.limit ?? '50'), 10) || 50))
  const [tools, total] = await Promise.all([
    Tool.find().select('name slug category description icon isActive usageCount').sort({ category: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Tool.countDocuments(),
  ])
  response.json({ tools, pagination: { page, limit, total } })
})

router.patch('/tools/:slug', async (request, response) => {
  const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).safeParse(request.params.slug)
  const status = toolStatusSchema.safeParse(request.body)
  if (!slug.success || !status.success) throw new HttpError(400, 'A valid tool slug and active status are required.')
  const tool = await Tool.findOneAndUpdate({ slug: slug.data }, { $set: status.data }, { new: true })
    .select('name slug category description icon isActive usageCount')
    .lean()
  if (!tool) throw new HttpError(404, 'Tool not found.')
  response.json({ tool })
})

export default router
