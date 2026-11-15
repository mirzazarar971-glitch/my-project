import { Router } from 'express'
import { z } from 'zod'
import Tool from '../models/Tool.js'
import Activity from '../models/Activity.js'
import User from '../models/User.js'
import { optionalAuth } from '../middleware/auth.js'
import { requireDatabase } from '../middleware/database.js'
import { HttpError } from '../utils/httpError.js'

const router = Router()
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

router.get('/', requireDatabase, async (_request, response) => {
  const tools = await Tool.find({ isActive: true }).select('name slug category description icon usageCount').sort({ category: 1, name: 1 }).lean()
  response.json({ tools })
})

router.post('/:slug/use', requireDatabase, optionalAuth, async (request, response) => {
  const parsed = slugSchema.safeParse(request.params.slug)
  if (!parsed.success) throw new HttpError(400, 'A valid tool slug is required.')
  const tool = await Tool.findOneAndUpdate(
    { slug: parsed.data, isActive: true },
    { $inc: { usageCount: 1 } },
    { new: true, projection: '_id' },
  )
  if (!tool) throw new HttpError(404, 'This tool is not available.')
  await Activity.create({ toolId: tool.id, userId: request.user?.id ?? null, action: 'used' })
  if (request.user) {
    await User.updateOne({ _id: request.user.id }, {
      $pull: { recentlyUsed: parsed.data },
    })
    await User.updateOne({ _id: request.user.id }, {
      $push: { recentlyUsed: { $each: [parsed.data], $position: 0, $slice: 12 } },
    })
  }
  response.status(201).json({ recorded: true })
})

export default router
