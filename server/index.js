import 'dotenv/config'
import app from './app.js'
import { connectDatabase } from './config/database.js'

const port = Number.parseInt(process.env.PORT ?? '5000', 10)

async function start() {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.')
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('replace_with'))) {
    throw new Error('Production requires a JWT_SECRET of at least 32 characters.')
  }
  await connectDatabase()
  app.listen(port, () => {
    console.info(`DevTools Hub API listening on http://localhost:${port}`)
  })
}

start().catch((error) => {
  console.error('Server startup failed:', error)
  process.exitCode = 1
})
