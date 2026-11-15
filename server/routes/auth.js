import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import User from '../models/User.js'
import Tool from '../models/Tool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireDatabase } from '../middleware/database.js'
import { HttpError } from '../utils/httpError.js'

const router = Router()
const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
}).strict()
const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1).max(70),
}).strict()
const favoriteSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  action: z.enum(['add', 'remove']),
}).strict()

const userPayload = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  favorites: user.favorites,
  recentlyUsed: user.recentlyUsed,
})

const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api',
  maxAge: 7 * 24 * 60 * 60 * 1000,
})

const signIn = (response, user) => {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) throw new HttpError(503, 'Authentication is not configured on this server.')
  const token = jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: '7d', issuer: 'devtools-hub' })
  response.cookie('devtools_session', token, sessionCookieOptions())
}

router.post('/register', requireDatabase, async (request, response) => {
  const parsed = registerSchema.safeParse(request.body)
  if (!parsed.success) throw new HttpError(400, 'Please check the registration details.', parsed.error.flatten())
  const { name, email, password } = parsed.data
  const existing = await User.exists({ email })
  if (existing) throw new HttpError(409, 'An account with this email already exists.')
  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await User.create({ name, email, password: hashedPassword })
  signIn(response, user)
  response.status(201).json({ user: userPayload(user) })
})

router.post('/login', requireDatabase, async (request, response) => {
  const parsed = credentialsSchema.safeParse(request.body)
  if (!parsed.success) throw new HttpError(400, 'Enter a valid email address and password.')
  const user = await User.findOne({ email: parsed.data.email }).select('+password')
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password))) {
    throw new HttpError(401, 'Email or password is incorrect.')
  }
  signIn(response, user)
  response.json({ user: userPayload(user) })
})

router.post('/logout', (_request, response) => {
  response.clearCookie('devtools_session', { ...sessionCookieOptions(), maxAge: undefined })
  response.status(204).end()
})

router.get('/me', requireDatabase, requireAuth, (request, response) => {
  response.json({ user: userPayload(request.user) })
})

router.patch('/favorites', requireDatabase, requireAuth, async (request, response) => {
  const parsed = favoriteSchema.safeParse(request.body)
  if (!parsed.success) throw new HttpError(400, 'A valid tool slug and favorite action are required.')
  const tool = await Tool.findOne({ slug: parsed.data.slug, isActive: true }).select('_id')
  if (!tool) throw new HttpError(404, 'This tool is not available.')
  if (parsed.data.action === 'add') {
    await User.updateOne({ _id: request.user.id }, { $addToSet: { favorites: parsed.data.slug } })
  } else {
    await User.updateOne({ _id: request.user.id }, { $pull: { favorites: parsed.data.slug } })
  }
  const user = await User.findById(request.user.id).select('_id name email role favorites recentlyUsed')
  response.json({ user: userPayload(user) })
})

export default router
