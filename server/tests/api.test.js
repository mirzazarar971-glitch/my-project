import assert from 'node:assert/strict'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import app from '../app.js'

delete process.env.MONGODB_URI

test('health endpoint reports API status and security headers', async () => {
  const response = await request(app).get('/api/health').expect(200)
  assert.equal(response.body.status, 'ok')
  assert.equal(response.body.database, 'not-configured')
  assert.equal(response.headers['x-powered-by'], undefined)
  assert.ok(response.headers['x-content-type-options'])
})

test('API rejects unapproved browser origins', async () => {
  const response = await request(app).get('/api/health').set('Origin', 'https://not-allowed.example').expect(403)
  assert.match(response.body.error, /origin is not allowed/i)
})

test('public registration is permanently disabled', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Public User',
    email: 'public@example.com',
    password: 'strong-password-123',
  }).expect(410)
  assert.match(response.body.error, /registration is disabled/i)
})

test('private analytics APIs reject unauthenticated requests before database access', async () => {
  const response = await request(app).get('/api/admin/analytics?startDate=2026-11-01&endDate=2026-11-07').expect(401)
  assert.match(response.body.error, /log in/i)
})

test('analytics ingestion validates event shapes and requires a database for valid public events', async () => {
  await request(app).post('/api/analytics/events').send({
    events: [{
      type: 'page_view',
      eventId: '01234567-89ab-4cde-8fab-0123456789ab',
      visitorId: '11234567-89ab-4cde-8fab-0123456789ab',
      sessionId: '21234567-89ab-4cde-8fab-0123456789ab',
      path: '/tools/json-formatter?email=private@example.com',
    }],
  }).expect(400)
  const response = await request(app).post('/api/analytics/events').send({
    events: [{
      type: 'page_view',
      eventId: '01234567-89ab-4cde-8fab-0123456789ab',
      visitorId: '11234567-89ab-4cde-8fab-0123456789ab',
      sessionId: '21234567-89ab-4cde-8fab-0123456789ab',
      path: '/tools/json-formatter',
    }],
  }).expect(503)
  assert.match(response.body.error, /MongoDB connection/)
})

test('administrator events are excluded using the signed role claim', async () => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters'
  try {
    const token = jwt.sign({ sub: 'administrator-id', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1m', issuer: 'devtools-hub' })
    const response = await request(app)
      .post('/api/analytics/events')
      .set('Cookie', `devtools_session=${token}`)
      .send({ events: [{ type: 'heartbeat', visitorId: '01234567-89ab-4cde-8fab-0123456789ab', sessionId: '11234567-89ab-4cde-8fab-0123456789ab' }] })
      .expect(202)
    assert.deepEqual(response.body, { accepted: 0, excluded: true })
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  }
})

test('legacy tool usage endpoint does not accept or execute submitted code', async () => {
  const response = await request(app).post('/api/tools/javascript-playground/use').send({
    input: 'throw new Error("must remain browser-only")',
  }).expect(404)
  assert.match(response.body.error, /not found/i)
})
