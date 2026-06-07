import { describe, expect, it } from 'vitest'
import crypto from 'crypto'

import { signSession, verifySession } from './session'

describe('session token', () => {
  it('sign → verify trả lại đúng customerId', () => {
    const token = signSession('cust-123')
    expect(verifySession(token)).toBe('cust-123')
  })

  it('từ chối token rỗng / sai định dạng', () => {
    expect(verifySession(null)).toBeNull()
    expect(verifySession('')).toBeNull()
    expect(verifySession('abc')).toBeNull()
    expect(verifySession('a.b')).toBeNull()
  })

  it('từ chối token bị sửa chữ ký (tamper)', () => {
    const [h, p] = signSession('cust-1').split('.')
    const forged = `${h}.${p}.${'x'.repeat(43)}`
    expect(verifySession(forged)).toBeNull()
  })

  it('từ chối token đã hết hạn', () => {
    const secret = process.env.PAYLOAD_SECRET || 'dev-secret-change-me'
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const past = Math.floor(Date.now() / 1000) - 10
    const payload = Buffer.from(JSON.stringify({ sub: 'cust-9', iat: past - 100, exp: past })).toString(
      'base64url',
    )
    const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
    expect(verifySession(`${header}.${payload}.${sig}`)).toBeNull()
  })
})
