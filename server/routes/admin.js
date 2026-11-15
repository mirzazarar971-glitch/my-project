import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import Activity from '../models/Activity.js'
import Tool from '../models/Tool.js'
import User from '../models/User.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { requireDatabase } from '../middleware/database.js'
import { HttpError } from '../utils/httpError.js'

const router = Router()
const roleSchema = z.object({ role: z.enum(['user', 'admin']) }).strict()
const toolStatusSchema = z.object({ isActive: z.boolean() }).strict()

router.use(requireDatabase, requireAuth, requireAdmin)

router.get('/stats', async (_request, response) => {
  const [totalUsers, activeTools, totalTools, totalActivity, popularTools] = await Promise.all([
    User.countDocuments(),
    Tool.countDocuments({ isActive: true }),
    Tool.countDocuments(),
    Activity.countDocuments(),
    Tool.find().select('name slug category usageCount isActive').sort({ usageCount: -1, name: 1 }).limit(8).lean(),
  ])
  response.json({ stats: { totalUsers, activeTools, totalTools, totalActivity }, popularTools })
})

router.get('/tools', async (request, response) => {
  const page = Math.max(1, Number.parseInt(String(request.query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(request.query.limit ?? '50'), 10) || 50))
  const [tools, total] = await Promise.all([
    Tool.find().select('name slug category description icon isActive usageCount').sort({ category: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Tool.countDocuments(),
  ])
  response.json({ tools, pagination: { page, limit, total } })
})

router.patch('/tools/:slug', async (request, response) => {
  const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).safeParse(request.params.slug)
  const status = toolStatusSchema.safeParse(request.body)
  if (!slug.success || !status.success) throw new HttpError(400, 'A valid tool slug and active status are required.')
  const tool = await Tool.findOneAndUpdate({ slug: slug.data }, { $set: status.data }, { new: true })
    .select('name slug category description icon isActive usageCount')
    .lean()
  if (!tool) throw new HttpError(404, 'Tool not found.')
  response.json({ tool })
})

router.get('/users', async (request, response) => {
  const page = Math.max(1, Number.parseInt(String(request.query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(request.query.limit ?? '25'), 10) || 25))
  const search = z.string().trim().max(100).safeParse(request.query.search ?? '')
  if (!search.success) throw new HttpError(400, 'Search is too long.')
  const filter = search.data
    ? { $or: [{ email: { $regex: escapeRegex(search.data), $options: 'i' } }, { name: { $regex: escapeRegex(search.data), $options: 'i' } }] }
    : {}
  const [users, total] = await Promise.all([
    User.find(filter).select('name email role createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ])
  response.json({ users, pagination: { page, limit, total } })
})

router.patch('/users/:id/role', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new HttpError(400, 'A valid user ID is required.')
  const parsed = roleSchema.safeParse(request.body)
  if (!parsed.success) throw new HttpError(400, 'Choose a valid user role.')
  if (String(request.user.id) === request.params.id && parsed.data.role !== 'admin') {
    throw new HttpError(400, 'You cannot remove your own administrator role.')
  }
  const user = await User.findByIdAndUpdate(request.params.id, { $set: parsed.data }, { new: true, runValidators: true })
    .select('name email role createdAt')
    .lean()
  if (!user) throw new HttpError(404, 'User not found.')
  response.json({ user })
})

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default router
