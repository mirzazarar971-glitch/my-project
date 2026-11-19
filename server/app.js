import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import authRoutes from './routes/auth.js'
import toolRoutes from './routes/tools.js'
import adminRoutes from './routes/admin.js'
import analyticsRoutes from './routes/analytics.js'
import { HttpError } from './utils/httpError.js'

const app = express()
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new HttpError(403, 'This origin is not allowed by the API CORS policy.'))
  },
  credentials: true,
}))
app.use(express.json({ limit: '64kb', strict: true }))
app.use(cookieParser())
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 180,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
}))
app.use('/api/analytics', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 90,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Analytics event limit reached. Please try again later.' },
}))

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    database: process.env.MONGODB_URI ? 'configured' : 'not-configured',
    service: 'DevTools Hub API',
  })
})
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (request) => !['POST'].includes(request.method) || request.path !== '/login',
}), authRoutes)
app.use('/api/tools', toolRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/admin', adminRoutes)
app.use((_request, response) => {
  response.status(404).json({ error: 'API route not found.' })
})

app.use((error, _request, response, _next) => {
  const status = error.code === 11000 ? 409
    : error.name === 'ValidationError' ? 400
      : Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500
  const expectedMissingDatabase = error instanceof HttpError && status === 503 && error.message.includes('requires a configured MongoDB')
  if (status >= 500 && !expectedMissingDatabase) console.error('API request failed:', error)
  const message = status === 500 ? 'An unexpected server error occurred.'
    : status === 409 ? 'A record with these details already exists.'
      : status === 400 && error.name === 'ValidationError' ? 'The submitted data is invalid.'
        : error.message
  response.status(status).json({
    error: message,
    ...(error.details ? { details: error.details } : {}),
  })
})

export default app
