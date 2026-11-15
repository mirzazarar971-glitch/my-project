import assert from 'node:assert/strict'
import test from 'node:test'
import request from 'supertest'
import app from '../app.js'

delete process.env.MONGODB_URI

test('health endpoint reports API status and database configuration', async () => {
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

test('database-backed account and tool APIs return an explicit service-unavailable error', async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Test User',
    email: 'test@example.com',
    password: 'strong-password-123',
  }).expect(503)
  assert.match(register.body.error, /MongoDB connection/)

  const tools = await request(app).get('/api/tools').expect(503)
  assert.match(tools.body.error, /MongoDB connection/)

  const admin = await request(app).get('/api/admin/stats').expect(503)
  assert.match(admin.body.error, /MongoDB connection/)
})

test('tool usage endpoint does not accept or execute user code on the server', async () => {
  const response = await request(app).post('/api/tools/javascript-playground/use').send({
    input: 'throw new Error("must remain browser-only")',
  }).expect(503)
  assert.match(response.body.error, /MongoDB connection/)
})
