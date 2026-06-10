import type { Endpoint, PayloadRequest } from 'payload'

import { json, readBody, getCustomer, unauthorized } from '../lib/req'
import {
  signCreateOrderMac,
  verifyCallbackMac,
  verifyOverallMac,
  verifyNotifyMac,
  notifyOrderPaid,
  type CallbackData,
} from '../lib/payment'

const relId = (v: any): string => String(typeof v === 'object' ? v?.id : v)

// ─── POST /api/v1/payments/mac ─────────────────────────────────────────────────
// FE gọi trước Payment.createOrder(): tạo mac cho params. Auth required.
// Body: { orderId }. Trả: { params, mac } để FE truyền thẳng vào zmp-sdk.
const createMacConfig: Endpoint = {
  path: '/v1/payments/mac',
  method: 'post',
  handler: async (req) => {
    const customer = await getCustomer(req)
    if (!customer) return unauthorized()
    const body = await readBody(req)

    const orderId = String(body.orderId ?? '').trim()
    if (!orderId) return json({ error: 'Thiếu orderId' }, 400)

    // Load order — chỉ chủ đơn, đơn phải ở trạng thái chờ thanh toán.
    let order: any
    try {
      order = await req.payload.findByID({
        collection: 'orders',
        id: orderId,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      return json({ error: 'Không tìm thấy đơn hàng' }, 404)
    }
    if (relId(order.customer) !== String(customer.id)) {
      return json({ error: 'Không có quyền xử lý đơn hàng này' }, 403)
    }
    if (order.paymentMethod !== 'zalopay') {
      return json({ error: 'Đơn hàng không phải thanh toán ZaloPay' }, 400)
    }
    if (order.paymentStatus === 'paid') {
      return json({ error: 'Đơn hàng đã được thanh toán' }, 400)
    }

    // Dựng params cho Payment.createOrder(). item phải là string.
    const items = (Array.isArray(order.items) ? order.items : []).map((it: any) => ({
      id: String(it.productId ?? ''),
      amount: (it.price ?? 0) * (it.quantity ?? 1),
    }))
    const extradata = JSON.stringify({
      orderId: String(order.id),
      orderCode: order.orderCode ?? '',
    })
    const method = JSON.stringify({ id: 'ZALOPAY', isCustom: false })

    const params = {
      amount: order.total ?? 0,
      desc: `Thanh toán đơn hàng ${order.orderCode ?? ''}`.trim(),
      item: JSON.stringify(items),
      extradata,
      method,
    }
    const mac = signCreateOrderMac(params)

    return json({ params, mac })
  },
}

// ─── POST /api/v1/payments/callback ────────────────────────────────────────────
// Checkout SDK Server gọi khi thanh toán hoàn tất (thành công HOẶC thất bại).
// PUBLIC — không bearer, verify bằng mac/overallMac.
// Trả: 1=thành công, 2=trùng (đã xử lý), khác=thất bại.
const callbackConfig: Endpoint = {
  path: '/v1/payments/callback',
  method: 'post',
  handler: async (req) => {
    const body = await readBody(req)
    const data = body.data as CallbackData | undefined
    const mac = String(body.mac ?? '')
    const overallMac = body.overallMac as string | undefined

    if (!data || !mac) {
      console.warn('[payment:callback] Missing data or mac')
      return json({ returnCode: -1 })
    }

    // Verify chữ ký — ưu tiên overallMac nếu có extradata/method.
    let valid = false
    if (overallMac && (data.extradata || data.method)) {
      // Dùng overallMac (sắp xếp toàn bộ field)
      const allFields: Record<string, string | number> = {}
      for (const [k, v] of Object.entries(data)) {
        if (v != null) allFields[k] = v as string | number
      }
      valid = verifyOverallMac(allFields, overallMac)
    }
    if (!valid) {
      valid = verifyCallbackMac(data, mac)
    }
    if (!valid) {
      console.error('[payment:callback] ⚠️ SECURITY: Invalid mac/overallMac', {
        orderId: data.orderId,
        transId: data.transId,
      })
      return json({ returnCode: -1 })
    }

    // Parse orderId nội bộ từ extradata (chúng ta truyền qua extradata.orderId).
    let internalOrderId: string | null = null
    if (data.extradata) {
      try {
        const decoded = decodeURIComponent(data.extradata)
        const parsed = JSON.parse(decoded)
        internalOrderId = parsed.orderId ?? null
      } catch {
        // extradata không parse được → thử dùng merchantTransId
      }
    }
    if (!internalOrderId && data.merchantTransId) {
      internalOrderId = data.merchantTransId
    }
    if (!internalOrderId) {
      console.warn('[payment:callback] Cannot determine internal orderId', data)
      return json({ returnCode: -1 })
    }

    // Load order.
    let order: any
    try {
      order = await req.payload.findByID({
        collection: 'orders',
        id: internalOrderId,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      console.warn('[payment:callback] Order not found:', internalOrderId)
      return json({ returnCode: -1 })
    }

    // Idempotent: đã xử lý → trả 2 (docs: 2 = trùng mã giao dịch).
    if (order.paymentStatus === 'paid') {
      return json({ returnCode: 2 })
    }

    const now = new Date().toISOString()
    const resultCode = data.resultCode

    if (resultCode === 1) {
      // Thanh toán thành công → set paid + lưu zpOrderId/zpTransId/paidAt.
      const statusHistory = Array.isArray(order.statusHistory) ? [...order.statusHistory] : []
      // Nếu chưa confirmed, có thể giữ nguyên status; chỉ cập nhật paymentStatus.
      await req.payload.update({
        collection: 'orders',
        id: String(order.id),
        overrideAccess: true,
        data: {
          paymentStatus: 'paid',
          zpOrderId: String(data.orderId ?? ''),
          zpTransId: String(data.transId ?? ''),
          paidAt: now,
          statusHistory: [...statusHistory, { status: order.status, at: now }],
        },
      })
      // D4: Hook thông báo (hiện no-op).
      await notifyOrderPaid(order)
      console.log(`[payment:callback] Order ${order.orderCode} → paid (transId: ${data.transId})`)
      return json({ returnCode: 1 })
    } else {
      // Thanh toán thất bại → set failed.
      await req.payload.update({
        collection: 'orders',
        id: String(order.id),
        overrideAccess: true,
        data: { paymentStatus: 'failed' },
      })
      console.log(`[payment:callback] Order ${order.orderCode} → failed (resultCode: ${resultCode})`)
      return json({ returnCode: 1 }) // Trả 1 = đã nhận xử lý, không cần retry
    }
  },
}

// ─── POST /api/v1/payments/notify ──────────────────────────────────────────────
// Checkout SDK gọi khi user chọn COD hoặc chuyển khoản ngân hàng.
// PUBLIC — không bearer, verify bằng mac.
// Trả: 1=thành công, khác=thất bại.
const notifyConfig: Endpoint = {
  path: '/v1/payments/notify',
  method: 'post',
  handler: async (req) => {
    const body = await readBody(req)
    const data = body.data as { appId: string; orderId: string; method: string } | undefined
    const mac = String(body.mac ?? '')

    if (!data || !mac) {
      console.warn('[payment:notify] Missing data or mac')
      return json({ returnCode: -1 })
    }

    if (!verifyNotifyMac(data, mac)) {
      console.error('[payment:notify] ⚠️ SECURITY: Invalid mac', { orderId: data.orderId })
      return json({ returnCode: -1 })
    }

    console.log(`[payment:notify] Method ${data.method} selected for order ${data.orderId}`)
    // COD: ghi nhận phương thức thanh toán. Không cập nhật paymentStatus (vẫn unpaid tới khi giao hàng).
    return json({ returnCode: 1 })
  },
}

export const paymentEndpoints: Endpoint[] = [createMacConfig, callbackConfig, notifyConfig]
