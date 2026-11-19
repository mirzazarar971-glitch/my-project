import AnalyticsEvent from '../models/AnalyticsEvent.js'
import AnalyticsSession from '../models/AnalyticsSession.js'
import AnalyticsVisitor from '../models/AnalyticsVisitor.js'
import { getActiveWindowSeconds, getSessionTimeoutMinutes } from '../utils/analytics.js'

const emptyCount = (rows) => rows[0]?.count ?? 0

export async function buildAnalyticsReport({ start, endExclusive, granularity }) {
  const now = new Date()
  const sessionTimeoutMs = getSessionTimeoutMinutes() * 60 * 1000
  const activeCutoff = new Date(now.getTime() - getActiveWindowSeconds() * 1000)
  const sessionFilter = { startedAt: { $gte: start, $lt: endExclusive } }
  const eventFilter = { timestamp: { $gte: start, $lt: endExclusive } }
  const dateUnit = granularity === 'month' ? 'month' : granularity === 'week' ? 'week' : 'day'
  const dateGroup = {
    $dateTrunc: {
      date: '$startedAt',
      unit: dateUnit,
      timezone: 'UTC',
      ...(dateUnit === 'week' ? { startOfWeek: 'monday' } : {}),
    },
  }

  const [
    sessions,
    sessionTotals,
    activeVisitors,
    newVisitors,
    returningVisitors,
    sessionDuration,
    bounceMetrics,
    eventMetrics,
    pageMetrics,
    pageEngagement,
    toolMetrics,
    trafficSources,
    campaigns,
    countries,
    devices,
    browsers,
    operatingSystems,
    searchMetrics,
    recentActivity,
  ] = await Promise.all([
    AnalyticsSession.aggregate([
      { $match: sessionFilter },
      { $group: {
        _id: dateGroup,
        sessions: { $sum: 1 },
        visitors: { $addToSet: '$visitorHash' },
      } },
      { $project: { _id: 0, date: '$_id', sessions: 1, uniqueVisitors: { $size: '$visitors' } } },
      { $sort: { date: 1 } },
    ]),
    AnalyticsSession.aggregate([
      { $match: sessionFilter },
      { $group: { _id: null, sessions: { $sum: 1 }, visitors: { $addToSet: '$visitorHash' } } },
      { $project: { _id: 0, sessions: 1, uniqueVisitors: { $size: '$visitors' } } },
    ]),
    AnalyticsSession.aggregate([
      { $match: { lastSeenAt: { $gte: activeCutoff }, expiresAt: { $gt: now } } },
      { $group: { _id: '$visitorHash' } },
      { $count: 'count' },
    ]),
    AnalyticsVisitor.countDocuments({ firstSeenAt: { $gte: start, $lt: endExclusive } }),
    AnalyticsVisitor.countDocuments({ firstSeenAt: { $lt: start }, lastSeenAt: { $gte: start, $lt: endExclusive } }),
    AnalyticsSession.aggregate([
      { $match: sessionFilter },
      { $project: {
        durationMs: {
          $min: [
            sessionTimeoutMs,
            { $max: [0, { $subtract: ['$lastSeenAt', '$startedAt'] }] },
          ],
        },
      } },
      { $group: { _id: null, averageMs: { $avg: '$durationMs' } } },
    ]),
    AnalyticsSession.aggregate([
      { $match: { ...sessionFilter, lastSeenAt: { $lt: new Date(now.getTime() - sessionTimeoutMs) } } },
      { $lookup: {
        from: AnalyticsEvent.collection.name,
        let: { sessionId: '$sessionHash' },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ['$sessionHash', '$$sessionId'] },
            { $eq: ['$type', 'page_view'] },
            { $gte: ['$timestamp', start] },
            { $lt: ['$timestamp', endExclusive] },
          ] } } },
          { $count: 'views' },
        ],
        as: 'pageViews',
      } },
      { $project: { pageViews: { $ifNull: [{ $arrayElemAt: ['$pageViews.views', 0] }, 0] } } },
      { $group: {
        _id: null,
        sessions: { $sum: 1 },
        bounced: { $sum: { $cond: [{ $eq: ['$pageViews', 1] }, 1, 0] } },
      } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: eventFilter },
      { $group: {
        _id: null,
        pageViews: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
        toolClicks: { $sum: { $cond: [{ $eq: ['$type', 'tool_click'] }, 1, 0] } },
        toolExecutions: { $sum: { $cond: [{ $eq: ['$type', 'tool_execution'] }, 1, 0] } },
        successfulExecutions: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'tool_execution'] }, { $eq: ['$success', true] }] }, 1, 0] } },
        failedExecutions: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'tool_execution'] }, { $eq: ['$success', false] }] }, 1, 0] } },
        searches: { $sum: { $cond: [{ $eq: ['$type', 'search'] }, 1, 0] } },
        zeroResultSearches: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'search'] }, { $eq: ['$resultCount', 0] }] }, 1, 0] } },
        totalQueryLength: { $sum: { $cond: [{ $eq: ['$type', 'search'] }, '$queryLength', 0] } },
      } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...eventFilter, type: 'page_view' } },
      { $group: {
        _id: '$path',
        views: { $sum: 1 },
        visitors: { $addToSet: '$visitorHash' },
      } },
      { $project: { _id: 0, path: '$_id', views: 1, uniqueVisitors: { $size: '$visitors' } } },
      { $sort: { views: -1, path: 1 } },
      { $limit: 100 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...eventFilter, type: 'page_engagement' } },
      { $group: { _id: '$path', averageEngagementMs: { $avg: '$durationMs' } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...eventFilter, type: { $in: ['tool_click', 'tool_execution'] } } },
      { $group: {
        _id: '$toolSlug',
        clicks: { $sum: { $cond: [{ $eq: ['$type', 'tool_click'] }, 1, 0] } },
        executions: { $sum: { $cond: [{ $eq: ['$type', 'tool_execution'] }, 1, 0] } },
        successes: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'tool_execution'] }, { $eq: ['$success', true] }] }, 1, 0] } },
        failures: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'tool_execution'] }, { $eq: ['$success', false] }] }, 1, 0] } },
      } },
      { $project: {
        _id: 0,
        slug: '$_id',
        clicks: 1,
        executions: 1,
        successes: 1,
        failures: 1,
        successRate: { $cond: [{ $gt: ['$executions', 0] }, { $multiply: [{ $divide: ['$successes', '$executions'] }, 100] }, null] },
      } },
      { $sort: { clicks: -1, executions: -1 } },
    ]),
    AnalyticsSession.aggregate([
      { $match: sessionFilter },
      { $group: { _id: '$trafficSource', sessions: { $sum: 1 } } },
      { $project: { _id: 0, source: { $ifNull: ['$_id', 'unknown'] }, sessions: 1 } },
      { $sort: { sessions: -1 } },
    ]),
    AnalyticsSession.aggregate([
      { $match: { ...sessionFilter, trafficSource: 'campaign' } },
      { $group: {
        _id: { source: '$campaign.source', medium: '$campaign.medium', name: '$campaign.name' },
        sessions: { $sum: 1 },
      } },
      { $project: { _id: 0, source: { $ifNull: ['$_id.source', 'unknown'] }, medium: { $ifNull: ['$_id.medium', ''] }, name: { $ifNull: ['$_id.name', ''] }, sessions: 1 } },
      { $sort: { sessions: -1 } },
      { $limit: 50 },
    ]),
    AnalyticsSession.aggregate([
      { $match: sessionFilter },
      { $group: { _id: { $ifNull: ['$country', 'unknown'] }, visitors: { $addToSet: '$visitorHash' } } },
      { $project: { _id: 0, country: '$_id', visitors: { $size: '$visitors' } } },
      { $sort: { visitors: -1 } },
      { $limit: 30 },
    ]),
    groupSessionsBy(AnalyticsSession, sessionFilter, '$deviceCategory', 'device'),
    groupSessionsBy(AnalyticsSession, sessionFilter, '$browser', 'browser'),
    groupSessionsBy(AnalyticsSession, sessionFilter, '$operatingSystem', 'operatingSystem'),
    AnalyticsEvent.aggregate([
      { $match: { ...eventFilter, type: 'search' } },
      { $group: {
        _id: null,
        searches: { $sum: 1 },
        zeroResultSearches: { $sum: { $cond: [{ $eq: ['$resultCount', 0] }, 1, 0] } },
        totalQueryLength: { $sum: '$queryLength' },
      } },
    ]),
    AnalyticsEvent.find({ ...eventFilter, type: { $in: ['page_view', 'tool_click', 'tool_execution', 'search'] } })
      .select('type timestamp path toolSlug success')
      .sort({ timestamp: -1 })
      .limit(20)
      .lean(),
  ])

  const topToolSlugs = toolMetrics.slice(0, 8).map((tool) => tool.slug)
  const toolTrends = topToolSlugs.length ? await AnalyticsEvent.aggregate([
    { $match: { ...eventFilter, toolSlug: { $in: topToolSlugs }, type: { $in: ['tool_click', 'tool_execution'] } } },
    { $group: {
      _id: {
        slug: '$toolSlug',
        date: { $dateTrunc: { date: '$timestamp', unit: dateUnit, timezone: 'UTC', ...(dateUnit === 'week' ? { startOfWeek: 'monday' } : {}) } },
      },
      clicks: { $sum: { $cond: [{ $eq: ['$type', 'tool_click'] }, 1, 0] } },
      executions: { $sum: { $cond: [{ $eq: ['$type', 'tool_execution'] }, 1, 0] } },
    } },
    { $project: { _id: 0, slug: '$_id.slug', date: '$_id.date', clicks: 1, executions: 1 } },
    { $sort: { date: -1, clicks: -1, executions: -1 } },
    { $limit: 100 },
  ]) : []

  const engagementByPath = new Map(pageEngagement.map((item) => [item._id, item.averageEngagementMs]))
  const pageRows = pageMetrics.map((page) => ({
    ...page,
    averageEngagementMs: Math.round(engagementByPath.get(page.path) ?? 0),
  }))
  const metrics = eventMetrics[0] ?? {
    pageViews: 0,
    toolClicks: 0,
    toolExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    searches: 0,
    zeroResultSearches: 0,
    totalQueryLength: 0,
  }
  const sessionStats = sessionTotals[0] ?? { sessions: 0, uniqueVisitors: 0 }
  const bounceStats = bounceMetrics[0] ?? { sessions: 0, bounced: 0 }
  const searchStats = searchMetrics[0] ?? { searches: 0, zeroResultSearches: 0, totalQueryLength: 0 }
  const seriesByDate = new Map(sessions.map((row) => [row.date.toISOString(), {
    date: row.date.toISOString().slice(0, 10),
    sessions: row.sessions,
    uniqueVisitors: row.uniqueVisitors,
    pageViews: 0,
  }]))
  const pageViewSeries = await AnalyticsEvent.aggregate([
    { $match: { ...eventFilter, type: 'page_view' } },
    { $group: { _id: { $dateTrunc: { date: '$timestamp', unit: dateUnit, timezone: 'UTC', ...(dateUnit === 'week' ? { startOfWeek: 'monday' } : {}) } }, pageViews: { $sum: 1 } } },
  ])
  for (const point of pageViewSeries) {
    const key = point._id.toISOString()
    const current = seriesByDate.get(key) ?? { date: key.slice(0, 10), sessions: 0, uniqueVisitors: 0, pageViews: 0 }
    current.pageViews = point.pageViews
    seriesByDate.set(key, current)
  }
  const cursor = new Date(start)
  while (cursor < endExclusive) {
    const bucket = new Date(cursor)
    if (dateUnit === 'week') {
      const weekday = (bucket.getUTCDay() + 6) % 7
      bucket.setUTCDate(bucket.getUTCDate() - weekday)
    } else if (dateUnit === 'month') {
      bucket.setUTCDate(1)
    } else {
      bucket.setUTCHours(0, 0, 0, 0)
    }
    const key = bucket.toISOString()
    if (!seriesByDate.has(key)) {
      seriesByDate.set(key, { date: key.slice(0, 10), sessions: 0, uniqueVisitors: 0, pageViews: 0 })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  const series = [...seriesByDate.values()].sort((a, b) => a.date.localeCompare(b.date))

  return {
    range: { start: start.toISOString().slice(0, 10), end: new Date(endExclusive.getTime() - 1).toISOString().slice(0, 10) },
    summary: {
      totalVisitors: sessionStats.sessions,
      uniqueVisitors: sessionStats.uniqueVisitors,
      newVisitors,
      returningVisitors,
      pageViews: metrics.pageViews,
      activeVisitors: emptyCount(activeVisitors),
      toolClicks: metrics.toolClicks,
      toolExecutions: metrics.toolExecutions,
      successfulExecutions: metrics.successfulExecutions,
      failedExecutions: metrics.failedExecutions,
      averageSessionDurationMs: Math.round(sessionDuration[0]?.averageMs ?? 0),
      bounceRate: bounceStats.sessions ? Math.round((bounceStats.bounced / bounceStats.sessions) * 1000) / 10 : 0,
      completedSessions: bounceStats.sessions,
    },
    series,
    pages: pageRows,
    tools: toolMetrics,
    toolTrends,
    trafficSources,
    campaigns,
    audience: { countries, devices, browsers, operatingSystems },
    search: {
      searches: searchStats.searches,
      zeroResultSearches: searchStats.zeroResultSearches,
      zeroResultRate: searchStats.searches ? Math.round((searchStats.zeroResultSearches / searchStats.searches) * 1000) / 10 : 0,
      averageQueryLength: searchStats.searches ? Math.round(searchStats.totalQueryLength / searchStats.searches) : 0,
    },
    recentActivity: recentActivity.map(({ type, timestamp, path, toolSlug, success }) => ({
      type,
      timestamp,
      ...(path ? { path } : {}),
      ...(toolSlug ? { toolSlug } : {}),
      ...(typeof success === 'boolean' ? { success } : {}),
    })),
    methodology: {
      totalVisitors: 'Counted as sessions that started during the selected range.',
      uniqueVisitors: 'Distinct first-party anonymous browser IDs observed in those sessions.',
      activeVisitors: `Distinct visitors with a heartbeat in the last ${getActiveWindowSeconds()} seconds.`,
      averageSessionDuration: 'Estimated from the first to last visible activity; capped by the configured inactivity timeout.',
      bounceRate: `One-page sessions divided by completed sessions. A session is completed after ${getSessionTimeoutMinutes()} minutes without a heartbeat; active sessions are excluded.`,
      country: process.env.ANALYTICS_COUNTRY_HEADER ? 'Country is read only from the configured, trusted reverse-proxy country header.' : 'Country is unavailable until a trusted reverse-proxy country header is configured.',
      search: 'Only query length and result count are stored; entered search text is never collected.',
    },
  }
}

function groupSessionsBy(Model, match, field, key) {
  return Model.aggregate([
    { $match: match },
    { $group: { _id: { $ifNull: [field, 'unknown'] }, sessions: { $sum: 1 } } },
    { $project: { _id: 0, [key]: '$_id', sessions: 1 } },
    { $sort: { sessions: -1 } },
    { $limit: 30 },
  ])
}
