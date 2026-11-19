import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import AnalyticsEvent from '../models/AnalyticsEvent.js'
import AnalyticsSession from '../models/AnalyticsSession.js'
import AnalyticsVisitor from '../models/AnalyticsVisitor.js'
import SearchConsoleOAuthState from '../models/SearchConsoleOAuthState.js'
import Tool from '../models/Tool.js'
import User from '../models/User.js'
import { toolCatalog } from '../data/toolCatalog.js'

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.warn('MongoDB is not configured. Public browser tools remain available; analytics and administrator sign-in return 503.')
    return false
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  await Promise.all([
    AnalyticsEvent.init(),
    AnalyticsSession.init(),
    AnalyticsVisitor.init(),
    SearchConsoleOAuthState.init(),
  ])
  await Tool.bulkWrite(toolCatalog.map((tool) => ({
    updateOne: {
      filter: { slug: tool.slug },
      update: { $setOnInsert: tool },
      upsert: true,
    },
  })))
  await bootstrapAdmin()
  console.info(`MongoDB connected; ${toolCatalog.length} tools synchronized.`)
  return true
}

export async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email && !password) return
  if (!email || !password || password.length < 12) {
    throw new Error('Set both ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters to bootstrap an administrator.')
  }

  const configuredAccount = await User.findOne({ email }).select('+password')
  if (configuredAccount) {
    if (configuredAccount.role !== 'admin') {
      throw new Error('ADMIN_EMAIL belongs to an existing non-administrator account. Choose a different ADMIN_EMAIL.')
    }
    await synchronizeAdminCredentials(configuredAccount, email, password)
    return
  }

  const existingAdmins = await User.find({ role: 'admin' }).select('+password').limit(2)
  if (existingAdmins.length > 1) {
    throw new Error('Multiple administrator accounts exist. Resolve them before changing ADMIN_EMAIL.')
  }
  if (existingAdmins.length === 1) {
    await synchronizeAdminCredentials(existingAdmins[0], email, password)
    return
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  await User.create({ name: 'DevTools Administrator', email, password: hashedPassword, role: 'admin' })
  console.info(`Initial administrator account created for ${email}.`)
}

async function synchronizeAdminCredentials(admin, email, password) {
  let changed = false
  if (admin.email !== email) {
    admin.email = email
    changed = true
  }
  if (!(await bcrypt.compare(password, admin.password))) {
    admin.password = await bcrypt.hash(password, 12)
    changed = true
  }
  if (changed) {
    await admin.save()
    console.info('Administrator credentials synchronized from server configuration.')
  }
}
