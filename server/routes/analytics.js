import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import AnalyticsEvent from '../models/AnalyticsEvent.js'
import AnalyticsSession from '../models/AnalyticsSession.js'
import AnalyticsVisitor from '../models/AnalyticsVisitor.js'
import Tool from '../models/Tool.js'
import { toolCatalog } from '../data/toolCatalog.js'
import { requireDatabase } from '../middleware/database.js'
import { HttpError } from '../utils/httpError.js'
import {
  classifyTraffic,
  getAnalyticsRetentionDays,
  getCountry,
  hashAnalyticsId,
  normalizeCampaign,
  normalizeReferrerHost,
  parseUserAgent,
} from '../utils/analytics.js'

const router = Router()
const idSchema = z.string().uuid()
const staticPages = new Set(['/', '/tools', '/profile', '/privacy-policy', '/terms-of-service', '/disclaimer', '/contact'])
const toolPaths = new Set(toolCatalog.map((tool) => `/tools/${tool.slug}`))
const categoryPaths = new Set([...new Set(toolCatalog.map((tool) => tool.category))].map((category) => `/category/${encodeURIComponent(category)}`))
const pathSchema = z.string().max(240)
  .regex(/^\/(?!admin(?:\/|$))[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/)
  .refine((path) => staticPages.has(path) || toolPaths.has(path) || categoryPaths.has(path), 'Path is not a public route.')
const hostSchema = z.string().max(253).regex(/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i)
const commonEvent = {
  eventId: idSchema,
  visitorId: idSchema,
  sessionId: idSchema,
  path: pathSchema.optional(),
}
const eventSchema = z.discriminatedUnion('type', [
  z.object({ ...commonEvent, type: z.literal('page_view'), path: pathSchema, referrerHost: hostSchema.optional(), campaign: z.object({
    source: z.string().max(80).optional(),
    medium: z.string().max(80).optional(),
    name: z.string().max(120).optional(),
  }).strict().optional() }).strict(),
  z.object({ ...commonEvent, type: z.literal('page_engagement'), path: pathSchema, durationMs: z.number().int().min(0).max(1_800_000) }).strict(),
  z.object({ ...commonEvent, type: z.literal('tool_click'), toolSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100) }).strict(),
  z.object({ ...commonEvent, type: z.literal('tool_execution'), toolSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100), success: z.boolean(), durationMs: z.number().int().min(0).max(1_800_000) }).strict(),
  z.object({ ...commonEvent, type: z.literal('search'), path: pathSchema, queryLength: z.number().int().min(0).max(200), resultCount: z.number().int().min(0).max(100) }).strict(),
  z.object({ visitorId: idSchema, sessionId: idSchema, type: z.literal('heartbeat'), path: pathSchema.optional() }).strict(),
])
const eventsSchema = z.object({
  events: z.array(eventSchema).min(1).max(20),
}).strict()

function isAdminSession(request) {
  const token = request.cookies?.devtools_session
  const secret = process.env.JWT_SECRET
  if (!token || !secret || secret.length < 32) return false
  try {
    const claims = jwt.verify(token, secret, { issuer: 'devtools-hub' })
    return typeof claims !== 'string' && claims.role === 'admin'
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) return false
    throw error
  }
}

router.post('/events', (request, response, next) => {
  if (isAdminSession(request)) return response.status(202).json({ accepted: 0, excluded: true })
  const parsed = eventsSchema.safeParse(request.body)
  if (!parsed.success) return next(new HttpError(400, 'Analytics events are invalid.', parsed.error.flatten()))
  request.analyticsEvents = parsed.data.events
  return next()
}, requireDatabase, async (request, response) => {

  const inputEvents = request.analyticsEvents
  const toolSlugs = [...new Set(inputEvents.filter((event) => 'toolSlug' in event).map((event) => event.toolSlug))]
  const activeTools = toolSlugs.length
    ? new Set((await Tool.find({ slug: { $in: toolSlugs }, isActive: true }).select('slug').lean()).map((tool) => tool.slug))
    : new Set()
  const events = inputEvents.filter((event) => !('toolSlug' in event) || activeTools.has(event.toolSlug))
  const now = new Date()
  const expiresAt = new Date(now.getTime() + getAnalyticsRetentionDays() * 24 * 60 * 60 * 1000)
  const country = getCountry(request)
  const dimensions = parseUserAgent(request.get('user-agent') ?? '')
  const writeEvents = events.filter((event) => event.type !== 'heartbeat')
  if (writeEvents.length) {
    await AnalyticsEvent.bulkWrite(writeEvents.map((event) => {
      const visitorHash = hashAnalyticsId(event.visitorId)
      const sessionHash = hashAnalyticsId(event.sessionId)
      const campaign = event.type === 'page_view' ? normalizeCampaign(event.campaign) : undefined
      const referrerHost = event.type === 'page_view' ? normalizeReferrerHost(event.referrerHost) : undefined
      return {
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $setOnInsert: {
              eventId: event.eventId,
              type: event.type,
              visitorHash,
              sessionHash,
              timestamp: now,
              expiresAt,
              ...(event.path ? { path: event.path } : {}),
              ...('toolSlug' in event ? { toolSlug: event.toolSlug } : {}),
              ...('success' in event ? { success: event.success } : {}),
              ...('durationMs' in event ? { durationMs: event.durationMs } : {}),
              ...('queryLength' in event ? { queryLength: event.queryLength, resultCount: event.resultCount } : {}),
              ...(event.type === 'page_view' ? {
                trafficSource: classifyTraffic(referrerHost, campaign),
                ...(referrerHost ? { referrerHost } : {}),
                ...(campaign ? { campaign } : {}),
                ...(country ? { country } : {}),
                ...dimensions,
              } : {}),
            },
          },
          upsert: true,
        },
      }
    }), { ordered: false })
  }

  const sessionEvents = events.filter((event) => event.type === 'heartbeat' || event.type === 'page_view')
  for (const event of sessionEvents) {
    const visitorHash = hashAnalyticsId(event.visitorId)
    const sessionHash = hashAnalyticsId(event.sessionId)
    const campaign = event.type === 'page_view' ? normalizeCampaign(event.campaign) : undefined
    const referrerHost = event.type === 'page_view' ? normalizeReferrerHost(event.referrerHost) : undefined
    const sessionFilter = { visitorHash, sessionHash }
    const sessionUpdate = {
      $setOnInsert: {
        ...sessionFilter,
        startedAt: now,
        ...(event.type === 'page_view' ? {
          firstPath: event.path,
          trafficSource: classifyTraffic(referrerHost, campaign),
          ...(referrerHost ? { referrerHost } : {}),
          ...(campaign ? { campaign } : {}),
          ...(country ? { country } : {}),
          ...dimensions,
        } : {}),
      },
      $set: {
        lastSeenAt: now,
        expiresAt,
        ...(event.path ? { lastPath: event.path } : {}),
      },
    }
    let updateResult
    try {
      updateResult = await AnalyticsSession.updateOne(sessionFilter, sessionUpdate, { upsert: true })
    } catch (error) {
      if (error.code !== 11000) throw error
      updateResult = await AnalyticsSession.updateOne(sessionFilter, { $set: sessionUpdate.$set })
    }
    const newSession = updateResult.upsertedCount === 1
    const visitorUpdate = {
      $setOnInsert: { visitorHash, firstSeenAt: now, totalSessions: newSession ? 1 : 0 },
      $max: { lastSeenAt: now },
      $set: {
        expiresAt,
        ...(country ? { country } : {}),
        ...dimensions,
      },
    }
    let visitorResult
    try {
      visitorResult = await AnalyticsVisitor.updateOne({ visitorHash }, visitorUpdate, { upsert: true })
    } catch (error) {
      if (error.code !== 11000) throw error
      visitorResult = await AnalyticsVisitor.updateOne({ visitorHash }, {
        $max: { lastSeenAt: now },
        $set: visitorUpdate.$set,
      })
    }
    if (newSession && visitorResult.upsertedCount !== 1) {
      await AnalyticsVisitor.updateOne({ visitorHash }, { $inc: { totalSessions: 1 } })
    }
  }

  response.status(202).json({ accepted: writeEvents.length })
})

export default router
