import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import {
  decryptRefreshToken,
  encryptRefreshToken,
  getSearchConsoleConfig,
} from '../services/searchConsole.js'

const configNames = [
  'GSC_CLIENT_ID',
  'GSC_CLIENT_SECRET',
  'GSC_REDIRECT_URI',
  'GSC_SITE_URL',
  'GSC_TOKEN_ENCRYPTION_KEY',
]

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(configNames.map((name) => [name, process.env[name]]))
  for (const name of configNames) {
    if (values[name] === undefined) delete process.env[name]
    else process.env[name] = values[name]
  }
  try {
    return callback()
  } finally {
    for (const name of configNames) {
      if (previous[name] === undefined) delete process.env[name]
      else process.env[name] = previous[name]
    }
  }
}

test('Google Search Console reports unconfigured state without credentials', () => {
  withEnvironment({}, () => {
    assert.equal(getSearchConsoleConfig().configured, false)
  })
})

test('Google refresh tokens are encrypted with authenticated AES-GCM', () => {
  withEnvironment({ GSC_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') }, () => {
    const secret = 'google-refresh-token-that-must-not-be-stored-plaintext'
    const encrypted = encryptRefreshToken(secret)
    assert.equal(encrypted.ciphertext.includes(secret), false)
    assert.equal(decryptRefreshToken(encrypted), secret)
    assert.throws(() => decryptRefreshToken({ ...encrypted, authTag: randomBytes(16).toString('base64url') }))
  })
})
