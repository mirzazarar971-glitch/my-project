import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { requireDatabase } from '../middleware/database.js'
import { HttpError } from '../utils/httpError.js'

const router = Router()
const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
}).strict()
const userPayload = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
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

router.post('/register', (_request, _response, next) => {
  next(new HttpError(410, 'Public registration is disabled. Only provisioned administrators can sign in.'))
})

router.post('/login', requireDatabase, async (request, response) => {
  const parsed = credentialsSchema.safeParse(request.body)
  if (!parsed.success) throw new HttpError(400, 'Enter a valid email address and password.')
  const user = await User.findOne({ email: parsed.data.email }).select('+password')
  if (!user || user.role !== 'admin' || !(await bcrypt.compare(parsed.data.password, user.password))) {
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

export default router
