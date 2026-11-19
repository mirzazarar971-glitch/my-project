import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { bootstrapAdmin } from '../config/database.js'

function configureEnvironment(t, values) {
  const names = ['ADMIN_EMAIL', 'ADMIN_PASSWORD']
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]))
  for (const name of names) {
    if (values[name] === undefined) delete process.env[name]
    else process.env[name] = values[name]
  }
  t.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]
      else process.env[name] = previous[name]
    }
  })
}

function stubUserQueries(t, { configuredAccount = null, admins = [], created = [] } = {}) {
  t.mock.method(User, 'findOne', () => ({
    select: async () => configuredAccount,
  }))
  t.mock.method(User, 'find', () => ({
    select() {
      return { limit: async () => admins }
    },
  }))
  t.mock.method(User, 'create', async (record) => {
    created.push(record)
    return record
  })
  return created
}

function adminAccount({ email, password, role = 'admin' }) {
  return {
    email,
    password,
    role,
    saves: 0,
    async save() {
      this.saves += 1
    },
  }
}

test('bootstrap synchronizes a configured password to the existing administrator', async (t) => {
  configureEnvironment(t, {
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'new-secure-password',
  })
  const oldHash = await bcrypt.hash('old-secure-password', 4)
  const account = adminAccount({ email: 'admin@example.com', password: oldHash })
  const created = stubUserQueries(t, { configuredAccount: account })

  await bootstrapAdmin()

  assert.equal(await bcrypt.compare('new-secure-password', account.password), true)
  assert.equal(account.saves, 1)
  assert.equal(account.role, 'admin')
  assert.equal(created.length, 0)
})

test('bootstrap creates a hashed administrator when none exists', async (t) => {
  configureEnvironment(t, {
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'new-secure-password',
  })
  const created = stubUserQueries(t)

  await bootstrapAdmin()

  assert.equal(created.length, 1)
  assert.equal(created[0].email, 'admin@example.com')
  assert.equal(created[0].role, 'admin')
  assert.notEqual(created[0].password, 'new-secure-password')
  assert.equal(await bcrypt.compare('new-secure-password', created[0].password), true)
})

test('bootstrap updates the sole existing administrator when its configured email changes', async (t) => {
  configureEnvironment(t, {
    ADMIN_EMAIL: 'new-admin@example.com',
    ADMIN_PASSWORD: 'new-secure-password',
  })
  const oldHash = await bcrypt.hash('old-secure-password', 4)
  const account = adminAccount({ email: 'old-admin@example.com', password: oldHash })
  const created = stubUserQueries(t, { admins: [account] })

  await bootstrapAdmin()

  assert.equal(account.email, 'new-admin@example.com')
  assert.equal(await bcrypt.compare('new-secure-password', account.password), true)
  assert.equal(account.saves, 1)
  assert.equal(created.length, 0)
})

test('bootstrap refuses to promote a non-admin account with the configured email', async (t) => {
  configureEnvironment(t, {
    ADMIN_EMAIL: 'user@example.com',
    ADMIN_PASSWORD: 'new-secure-password',
  })
  const account = adminAccount({
    email: 'user@example.com',
    password: await bcrypt.hash('user-password', 4),
    role: 'user',
  })
  const created = stubUserQueries(t, { configuredAccount: account })

  await assert.rejects(bootstrapAdmin(), /existing non-administrator account/)
  assert.equal(account.role, 'user')
  assert.equal(account.saves, 0)
  assert.equal(created.length, 0)
})

test('bootstrap refuses to guess which of multiple administrators to update', async (t) => {
  configureEnvironment(t, {
    ADMIN_EMAIL: 'new-admin@example.com',
    ADMIN_PASSWORD: 'new-secure-password',
  })
  const admins = [
    adminAccount({ email: 'first@example.com', password: await bcrypt.hash('first-password', 4) }),
    adminAccount({ email: 'second@example.com', password: await bcrypt.hash('second-password', 4) }),
  ]
  const created = stubUserQueries(t, { admins })

  await assert.rejects(bootstrapAdmin(), /Multiple administrator accounts exist/)
  assert.deepEqual(admins.map((admin) => admin.saves), [0, 0])
  assert.equal(created.length, 0)
})
