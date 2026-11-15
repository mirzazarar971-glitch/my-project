import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { HttpError } from '../utils/httpError.js'

export async function requireAuth(request, _response, next) {
  const token = request.cookies?.devtools_session
  if (!token) return next(new HttpError(401, 'Please log in to continue.'))
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return next(new HttpError(503, 'Authentication is not configured on this server.'))
  }
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET)
    if (typeof claims === 'string' || typeof claims.sub !== 'string') {
      return next(new HttpError(401, 'Your session is invalid. Please log in again.'))
    }
    const user = await User.findById(claims.sub).select('_id name email role favorites recentlyUsed')
    if (!user) return next(new HttpError(401, 'Your account is no longer available.'))
    request.user = user
    return next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(new HttpError(401, 'Your session has expired. Please log in again.'))
    }
    return next(error)
  }
}

export function requireAdmin(request, _response, next) {
  if (request.user?.role !== 'admin') return next(new HttpError(403, 'Administrator access is required.'))
  return next()
}

export function optionalAuth(request, _response, next) {
  const token = request.cookies?.devtools_session
  if (!token) return next()
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return next(new HttpError(503, 'Authentication is not configured on this server.'))
  }
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET)
    if (typeof claims === 'string' || typeof claims.sub !== 'string') {
      return next(new HttpError(401, 'Your session is invalid. Please log in again.'))
    }
    User.findById(claims.sub).select('_id name email role favorites recentlyUsed')
      .then((user) => {
        if (!user) return next(new HttpError(401, 'Your account is no longer available.'))
        request.user = user
        return next()
      })
      .catch(next)
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(new HttpError(401, 'Your session has expired. Please log in again.'))
    }
    return next(error)
  }
}
