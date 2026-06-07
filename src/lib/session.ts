import crypto from 'crypto'
import type { PayloadRequest } from 'payload'

// Session token tự ký kiểu JWT HS256 — đủ cho demo, không thêm dependency.
// Ký bằng PAYLOAD_SECRET. PRODUCTION: cân nhắc rotate secret + TTL ngắn + refresh token.
const SECRET = process.env.PAYLOAD_SECRET || 'dev-secret-change-me'
const TTL_SECONDS = 60 * 60 * 24 * 30 // 30 ngày

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url')

const hmac = (data: string) =>
  crypto.createHmac('sha256', SECRET).update(data).digest('base64url')

export function signSession(customerId: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = b64url(JSON.stringify({ sub: customerId, iat: now, exp: now + TTL_SECONDS }))
  const signature = hmac(`${header}.${payload}`)
  return `${header}.${payload}.${signature}`
}

/** Trả về customerId nếu token hợp lệ & chưa hết hạn, ngược lại null. */
export function verifySession(token: string | null | undefined): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts
  const expected = hmac(`${header}.${payload}`)
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof data.exp === 'number' && data.exp < Math.floor(Date.now() / 1000)) return null
    return data.sub != null ? String(data.sub) : null
  } catch {
    return null
  }
}

/** Lấy Bearer token từ header Authorization. */
export function bearerToken(req: PayloadRequest): string | null {
  const headers = req.headers as unknown as { get?: (k: string) => string | null }
  const raw =
    typeof headers?.get === 'function'
      ? headers.get('authorization')
      : ((req.headers as unknown as Record<string, string>)?.authorization ?? null)
  if (!raw) return null
  const m = raw.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}
