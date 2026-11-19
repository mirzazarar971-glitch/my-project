import { Router } from 'express'
import Tool from '../models/Tool.js'
import { requireDatabase } from '../middleware/database.js'

const router = Router()

router.get('/', requireDatabase, async (_request, response) => {
  const tools = await Tool.find({ isActive: true }).select('name slug category description icon usageCount').sort({ category: 1, name: 1 }).lean()
  response.json({ tools })
})

export default router
