import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyTraffic,
  hashAnalyticsId,
  normalizeCampaign,
  parseDateRange,
  parseUserAgent,
} from '../utils/analytics.js'

test('anonymous identifiers are stored as stable keyed hashes, not raw IDs', () => {
  const previousSecret = process.env.ANALYTICS_HASH_SECRET
  process.env.ANALYTICS_HASH_SECRET = 'analytics-test-secret-with-at-least-32-characters'
  try {
    const first = hashAnalyticsId('random-visitor-id')
    assert.equal(first, hashAnalyticsId('random-visitor-id'))
    assert.equal(first.length, 64)
    assert.notEqual(first, 'random-visitor-id')
  } finally {
    if (previousSecret === undefined) delete process.env.ANALYTICS_HASH_SECRET
    else process.env.ANALYTICS_HASH_SECRET = previousSecret
  }
})

test('traffic sources distinguish campaigns, search, social, referrals, and direct visits', () => {
  assert.equal(classifyTraffic(undefined, undefined), 'direct')
  assert.equal(classifyTraffic('www.google.com', undefined), 'organic')
  assert.equal(classifyTraffic('www.linkedin.com', undefined), 'social')
  assert.equal(classifyTraffic('docs.example.com', undefined), 'referral')
  assert.equal(classifyTraffic(undefined, normalizeCampaign({ source: 'newsletter', medium: 'email' })), 'campaign')
})

test('audience parsing stores coarse device and browser labels only', () => {
  assert.deepEqual(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'), {
    browser: 'Safari',
    operatingSystem: 'iOS',
    deviceCategory: 'mobile',
  })
})

test('analytics date filters validate exact UTC days and reject future or oversized ranges', () => {
  const range = parseDateRange({ startDate: '2026-11-01', endDate: '2026-11-03' }, new Date('2026-11-18T00:00:00.000Z'))
  assert.equal(range.start.toISOString(), '2026-11-01T00:00:00.000Z')
  assert.equal(range.endExclusive.toISOString(), '2026-11-04T00:00:00.000Z')
  assert.throws(() => parseDateRange({ startDate: '2026-02-31', endDate: '2026-03-01' }, new Date('2026-11-18T00:00:00.000Z')), /invalid/i)
  assert.throws(() => parseDateRange({ startDate: '2026-11-19', endDate: '2026-11-19' }, new Date('2026-11-18T00:00:00.000Z')), /invalid/i)
  assert.throws(() => parseDateRange({ startDate: '2025-01-01', endDate: '2026-11-18' }, new Date('2026-11-18T00:00:00.000Z')), /366 days/i)
})
