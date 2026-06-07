import type { PayloadRequest } from 'payload'
import { addDataAndFileToRequest } from 'payload'

import { bearerToken, verifySession } from './session'

/** Trả Response JSON kèm status. */
export const json = (data: unknown, status = 200) => Response.json(data, { status })
export const notFound = (msg = 'Not found') => json({ error: msg }, 404)
export const unauthorized = (msg = 'Chưa đăng nhập') => json({ error: msg }, 401)

/** Đọc JSON body (Payload không tự parse cho custom endpoint). */
export async function readBody(req: PayloadRequest): Promise<Record<string, any>> {
  if (!req.data) {
    try {
      await addDataAndFileToRequest(req)
    } catch {
      /* không có body */
    }
  }
  return (req.data as Record<string, any>) ?? {}
}

/** Lấy query string (chuẩn hoá mảng → phần tử đầu). */
export const queryStr = (req: PayloadRequest, key: string): string | undefined => {
  const v = req.query?.[key]
  return Array.isArray(v) ? String(v[0]) : v != null ? String(v) : undefined
}

/** Khách hàng hiện hành theo session bearer token, hoặc null nếu chưa đăng nhập/sai token. */
export async function getCustomer(req: PayloadRequest, depth = 0) {
  const customerId = verifySession(bearerToken(req))
  if (!customerId) return null
  try {
    return await req.payload.findByID({ collection: 'customers', id: customerId, depth })
  } catch {
    return null
  }
}
