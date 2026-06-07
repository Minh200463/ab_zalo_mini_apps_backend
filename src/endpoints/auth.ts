import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest } from 'payload'

import { toCustomerDTO } from '../lib/dto'
import { bearerToken, signSession, verifySession } from '../lib/session'

const json = (data: unknown, status = 200) => Response.json(data, { status })

async function readBody(req: PayloadRequest): Promise<Record<string, any>> {
  if (!req.data) {
    try {
      await addDataAndFileToRequest(req)
    } catch {
      /* không có body */
    }
  }
  return (req.data as Record<string, any>) ?? {}
}

/** Khách hàng hiện hành theo session token, hoặc null nếu chưa đăng nhập / token sai. */
async function currentCustomer(req: PayloadRequest) {
  const customerId = verifySession(bearerToken(req))
  if (!customerId) return null
  try {
    return await req.payload.findByID({ collection: 'customers', id: customerId, depth: 1 })
  } catch {
    return null
  }
}

// POST /api/v1/auth/zalo — xác thực Zalo & tạo/đồng bộ hồ sơ + cấp session (FR-001).
// Body: { accessToken, zaloId, name, avatar, phone }
// DEMO: tin tưởng dữ liệu Zalo SDK trả về client-side.
// PRODUCTION: dùng accessToken gọi Zalo Open API (cần app secret) để lấy zaloId/phone thật,
//             KHÔNG tin field do client gửi.
const authZaloConfig: Endpoint = {
  path: '/v1/auth/zalo',
  method: 'post',
  handler: async (req) => {
    const body = await readBody(req)
    const zaloId = String(body.zaloId ?? '').trim()
    if (!zaloId) return json({ error: 'Thiếu zaloId/accessToken từ Zalo SDK' }, 400)

    const name = body.name ?? ''
    const avatar = body.avatar ?? ''
    const phone = body.phone ?? ''

    // Upsert theo zaloId — AC-003: không tạo hồ sơ thứ hai cho cùng Zalo User ID.
    const existing = await req.payload.find({
      collection: 'customers',
      where: { zaloId: { equals: zaloId } },
      limit: 1,
      depth: 1,
    })

    let customer
    if (existing.docs.length) {
      customer = await req.payload.update({
        collection: 'customers',
        id: existing.docs[0].id,
        depth: 1,
        data: {
          name,
          avatar,
          // Chỉ ghi đè phone khi lấy được (tránh xoá phone đã có nếu lần này không cấp quyền SĐT).
          ...(phone ? { phone } : {}),
        },
      })
    } else {
      customer = await req.payload.create({
        collection: 'customers',
        depth: 1,
        data: { zaloId, name, avatar, phone },
      })
    }

    const token = signSession(String(customer.id))
    return json({ token, customer: toCustomerDTO(req, customer) })
  },
}

// GET /api/v1/customers/me — hồ sơ khách hàng hiện hành (FR-001).
const customerMeGetConfig: Endpoint = {
  path: '/v1/customers/me',
  method: 'get',
  handler: async (req) => {
    const customer = await currentCustomer(req)
    if (!customer) return json({ error: 'Chưa đăng nhập' }, 401)
    return json(toCustomerDTO(req, customer))
  },
}

// PUT /api/v1/customers/me — cập nhật hồ sơ (tên/email/địa chỉ/SĐT) (FR-001).
const customerMePutConfig: Endpoint = {
  path: '/v1/customers/me',
  method: 'put',
  handler: async (req) => {
    const customer = await currentCustomer(req)
    if (!customer) return json({ error: 'Chưa đăng nhập' }, 401)
    const body = await readBody(req)
    const data: Record<string, any> = {}
    for (const key of ['name', 'email', 'address', 'phone', 'avatar'] as const) {
      if (typeof body[key] === 'string') data[key] = body[key]
    }
    const updated = await req.payload.update({
      collection: 'customers',
      id: customer.id,
      depth: 1,
      data,
    })
    return json(toCustomerDTO(req, updated))
  },
}

// PUT /api/v1/customers/me/default-store — lưu cửa hàng mặc định vào hồ sơ (FR-005).
// Body: { storeId }
const defaultStorePutConfig: Endpoint = {
  path: '/v1/customers/me/default-store',
  method: 'put',
  handler: async (req) => {
    const customer = await currentCustomer(req)
    if (!customer) return json({ error: 'Chưa đăng nhập' }, 401)
    const body = await readBody(req)
    const storeId = String(body.storeId ?? '').trim()
    if (!storeId) return json({ error: 'Thiếu storeId' }, 400)

    // Cửa hàng phải đang hoạt động (ALT-001: store đã lưu không còn active → FE tự chọn lại).
    try {
      const store = await req.payload.findByID({ collection: 'stores', id: storeId })
      if ((store as any).isActive === false) return json({ error: 'Cửa hàng không hoạt động' }, 400)
    } catch {
      return json({ error: 'Không tìm thấy cửa hàng' }, 404)
    }

    const updated = await req.payload.update({
      collection: 'customers',
      id: customer.id,
      depth: 1,
      data: { defaultStore: storeId },
    })
    return json(toCustomerDTO(req, updated))
  },
}

// Thứ tự: /v1/customers/me/default-store TRƯỚC /v1/customers/me để không bị nuốt route.
export const authEndpoints: Endpoint[] = [
  authZaloConfig,
  defaultStorePutConfig,
  customerMeGetConfig,
  customerMePutConfig,
]
