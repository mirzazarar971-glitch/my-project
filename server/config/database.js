import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import Tool from '../models/Tool.js'
import User from '../models/User.js'
import { toolCatalog } from '../data/toolCatalog.js'

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.warn('MongoDB is not configured. Local browser tools work, but account and admin APIs will return 503.')
    return false
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
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

async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email && !password) return
  if (!email || !password || password.length < 12) {
    throw new Error('Set both ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters to bootstrap an administrator.')
  }
  const exists = await User.exists({ email })
  if (exists) return
  const hashedPassword = await bcrypt.hash(password, 12)
  await User.create({ name: 'DevTools Administrator', email, password: hashedPassword, role: 'admin' })
  console.info(`Initial administrator account created for ${email}.`)
}
