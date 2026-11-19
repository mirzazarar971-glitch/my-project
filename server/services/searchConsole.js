import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { HttpError } from '../utils/httpError.js'

const authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth'
const tokenEndpoint = 'https://oauth2.googleapis.com/token'
const reportEndpoint = 'https://searchconsole.googleapis.com/webmasters/v3/sites'
const readOnlyScope = 'https://www.googleapis.com/auth/webmasters.readonly'

export function getSearchConsoleConfig() {
  const clientId = process.env.GSC_CLIENT_ID?.trim()
  const clientSecret = process.env.GSC_CLIENT_SECRET
  const redirectUri = process.env.GSC_REDIRECT_URI?.trim()
  const propertyUrl = process.env.GSC_SITE_URL?.trim()
  return {
    configured: Boolean(clientId && clientSecret && redirectUri && propertyUrl && getEncryptionKey(false)),
    clientId,
    clientSecret,
    redirectUri,
    propertyUrl,
  }
}

export function createAuthorizationUrl(state) {
  const config = getSearchConsoleConfig()
  if (!config.configured) {
    throw new HttpError(503, 'Google Search Console is not configured. Set its OAuth credentials, redirect URI, property URL, and token encryption key.')
  }
  const url = new URL(authorizationEndpoint)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', readOnlyScope)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  return url.toString()
}

export function encryptRefreshToken(refreshToken) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()])
  return {
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    authTag: cipher.getAuthTag().toString('base64url'),
  }
}

export function decryptRefreshToken(encryptedToken) {
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(encryptedToken.iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(encryptedToken.authTag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedToken.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export async function exchangeAuthorizationCode(code) {
  const config = getSearchConsoleConfig()
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const tokens = await readGoogleJson(response)
  return tokens
}

export async function fetchSearchConsoleReport(refreshToken, propertyUrl, { startDate, endDate }) {
  const config = getSearchConsoleConfig()
  const tokenResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const { access_token: accessToken } = await readGoogleJson(tokenResponse)
  const endpoint = `${reportEndpoint}/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`
  const query = async (dimensions) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions,
        rowLimit: 10,
        dataState: 'final',
        type: 'web',
      }),
      signal: AbortSignal.timeout(15_000),
    })
    return readGoogleJson(response)
  }
  const [totals, queries, pages] = await Promise.all([
    query([]),
    query(['query']),
    query(['page']),
  ])
  const metrics = totals.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  return {
    clicks: metrics.clicks ?? 0,
    impressions: metrics.impressions ?? 0,
    ctr: metrics.ctr ?? 0,
    averagePosition: metrics.position ?? 0,
    topQueries: (queries.rows ?? []).map((row) => ({
      query: row.keys?.[0] ?? '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    })),
    topPages: (pages.rows ?? []).map((row) => ({
      page: row.keys?.[0] ?? '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    })),
  }
}

function getEncryptionKey(throwWhenMissing = true) {
  const encoded = process.env.GSC_TOKEN_ENCRYPTION_KEY
  if (!encoded) {
    if (!throwWhenMissing) return undefined
    throw new HttpError(503, 'Google Search Console token encryption is not configured.')
  }
  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) {
    if (!throwWhenMissing) return undefined
    throw new HttpError(503, 'GSC_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.')
  }
  return key
}

async function readGoogleJson(response) {
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new HttpError(502, 'Google Search Console returned an unreadable response.')
  }
  if (!response.ok) {
    const description = typeof payload.error_description === 'string'
      ? payload.error_description.slice(0, 180)
      : typeof payload.error?.message === 'string'
        ? payload.error.message.slice(0, 180)
        : `HTTP ${response.status}`
    throw new HttpError(502, `Google Search Console request failed: ${description}`)
  }
  if (!payload || typeof payload !== 'object') {
    throw new HttpError(502, 'Google Search Console returned an invalid response.')
  }
  return payload
}
