import mongoose from 'mongoose'
import { HttpError } from '../utils/httpError.js'

export function requireDatabase(_request, _response, next) {
  if (!process.env.MONGODB_URI) return next(new HttpError(503, 'This endpoint requires a configured MongoDB connection.'))
  if (mongoose.connection.readyState !== 1) return next(new HttpError(503, 'The MongoDB service is temporarily unavailable.'))
  return next()
}
