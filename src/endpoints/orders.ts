import type { Endpoint, PayloadRequest } from 'payload'

import { toCartDTO, toOrderDTO } from '../lib/dto'
import { getCustomer, json, notFound, queryStr, readBody, unauthorized } from '../lib/req'
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type ReorderAvailability,
  genOrderCode,
  orderTotal,
  planReorder,
  shippingFeeByDistance,
} from '../lib/order'

const param = (req: PayloadRequest, key: string): string | undefined =>
  (req.routeParams?.[key] as string | undefined) ?? undefined

const relId = (v: any): string => String(typeof v === 'object' ? v?.id : v)

/** Tải đơn theo id và kiểm tra quyền chủ đơn. Trả { order } hoặc { error: Response }. */
async function loadOwnedOrder(
  req: PayloadRequest,
  orderId: string,
  customerId: string,
): Promise<{ order?: any; error?: Response }> {
  let order: any
  try {
    order = await req.payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return { error: notFound('Không tìm thấy đơn hàng') }
  }
  if (relId(order.customer) !== String(customerId)) {
    return { error: json({ error: 'Không có quyền xem đơn hàng này' }, 403) }
  }
  return { order }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// POST /api/v1/shipping/estimate  { storeId, lat?, lng?, type? }  — phí giao hàng (FR-025).
const shippingEstimateConfig: Endpoint = {
  path: '/v1/shipping/estimate',
  method: 'post',
  handler: async (req) => {
    const body = await readBody(req)
    const type = body.type === 'pickup' ? 'pickup' : 'shipping'
    if (type === 'pickup') return json({ fee: 0, distanceKm: null })

    const storeId = String(body.storeId ?? '').trim()
    const lat = Number(body.lat)
    const lng = Number(body.lng)
    let distanceKm: number | null = null
    if (storeId && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      try {
        const store = await req.payload.findByID({ collection: 'stores', id: storeId, depth: 0 })
        const loc = (store as any).location
        if (loc?.lat != null && loc?.lng != null) {
          distanceKm = haversineKm(lat, lng, loc.lat, loc.lng)
        }
      } catch {
        /* store không tồn tại → dùng mức mặc định */
      }
    }
    return json({ fee: shippingFeeByDistance(distanceKm, 'shipping'), distanceKm })
  },
}

// POST /api/v1/orders  — tạo đơn (FR-042). Body: { storeId, paymentMethod, delivery, note, shippingFee }
const createOrderConfig: Endpoint = {
  path: '/v1/orders',
  method: 'post',
  handler: async (req) => {
    const customer = await getCustomer(req)
    if (!customer) return unauthorized()
    const body = await readBody(req)

    const storeId = String(body.storeId ?? '').trim()
    if (!storeId) return json({ error: 'Thiếu storeId' }, 400)
    const paymentMethod = body.paymentMethod === 'zalopay' ? 'zalopay' : 'cod'

    // Hình thức nhận hàng + ràng buộc thông tin bắt buộc (AC-039, BR-04.03).
    const d = body.delivery ?? {}
    const type = d.type === 'pickup' ? 'pickup' : 'shipping'
    const delivery = {
      type,
      name: String(d.name ?? '').trim(),
      phone: String(d.phone ?? '').trim(),
      address: String(d.address ?? '').trim(),
      stationId: String(d.stationId ?? '').trim(),
    }
    if (!delivery.name || !delivery.phone) {
      return json({ error: 'Thiếu họ tên hoặc số điện thoại nhận hàng' }, 400)
    }
    if (type === 'shipping' && !delivery.address) {
      return json({ error: 'Thiếu địa chỉ giao hàng' }, 400)
    }
    if (type === 'pickup' && !delivery.stationId) {
      return json({ error: 'Thiếu cửa hàng nhận hàng' }, 400)
    }

    // Lấy giỏ hàng (customer, store).
    const cartRes = await req.payload.find({
      collection: 'carts',
      where: { and: [{ customer: { equals: String(customer.id) } }, { store: { equals: storeId } }] },
      depth: 2,
      limit: 1,
      overrideAccess: true,
    })
    const cart = cartRes.docs[0]
    const cartItems: any[] = ((cart?.items as any[]) ?? []).filter(
      (it: any) => it?.product && typeof it.product === 'object',
    )
    if (!cartItems.length) return json({ error: 'Giỏ hàng trống' }, 400)

    // Kiểm tra lại tồn kho (ALT-003): chặn nếu hết hàng / không đủ.
    const unavailable: { productId: string; title: string; available: number }[] = []
    for (const it of cartItems) {
      const p = it.product
      const inv = p.inventory ?? 0
      const inStock = typeof p.inStock === 'boolean' ? p.inStock : inv > 0
      if (!inStock || it.quantity > inv) {
        unavailable.push({ productId: String(p.id), title: p.title, available: inv })
      }
    }
    if (unavailable.length) {
      return json({ error: 'Một số sản phẩm không đủ tồn kho', items: unavailable }, 409)
    }

    // Tính tiền (BR-08.01, NFR-07). discount=0 ở P9 (engine khuyến mãi ráp ở P8).
    const items = cartItems.map((it: any) => {
      const p = it.product
      const price = p.price ?? 0
      return {
        productId: String(p.id),
        title: p.title ?? '',
        sku: p.sku ?? '',
        price,
        quantity: it.quantity,
        lineTotal: price * it.quantity,
      }
    })
    const subtotal = items.reduce((s: number, it: any) => s + it.lineTotal, 0)
    const shippingFee =
      type === 'pickup' ? 0 : Math.max(0, Number(body.shippingFee) || 0)
    const discount = 0
    const total = orderTotal({ subtotal, discount, shippingFee })

    // Trừ tồn kho (D5).
    for (const it of cartItems) {
      const p = it.product
      const nextInv = Math.max(0, (p.inventory ?? 0) - it.quantity)
      await req.payload.update({
        collection: 'products',
        id: String(p.id),
        overrideAccess: true,
        data: { inventory: nextInv, inStock: nextInv > 0 },
      })
    }

    // Tạo đơn với mã duy nhất (BR-04.05); retry nếu trùng mã.
    const now = new Date().toISOString()
    const data: any = {
      customer: String(customer.id),
      store: storeId,
      items,
      delivery,
      note: String(body.note ?? ''),
      subtotal,
      discount,
      shippingFee,
      total,
      paymentMethod,
      paymentStatus: paymentMethod === 'zalopay' ? 'pending' : 'unpaid',
      status: 'pending_confirm',
      statusHistory: [{ status: 'pending_confirm', at: now }],
    }
    let order
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        order = await req.payload.create({
          collection: 'orders',
          overrideAccess: true,
          data: { ...data, orderCode: genOrderCode(Date.now(), Math.random()) },
        })
        break
      } catch (e) {
        if (attempt === 2) throw e // hết lượt retry → ném lỗi
      }
    }

    // Xóa giỏ sau khi đặt (FR-042).
    if (cart) {
      await req.payload.delete({ collection: 'carts', id: String(cart.id), overrideAccess: true })
    }

    return json(toOrderDTO(req, order), 201)
  },
}

// GET /api/v1/customers/me/orders?status=  — danh sách đơn của khách, lọc server-side (FR-048).
// status: danh sách trạng thái phân tách bằng dấu phẩy (vd "pending_confirm,confirmed"); rỗng = tất cả.
const listOrdersConfig: Endpoint = {
  path: '/v1/customers/me/orders',
  method: 'get',
  handler: async (req) => {
    const customer = await getCustomer(req)
    if (!customer) return unauthorized()

    const statuses = (queryStr(req, 'status') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s))

    const where: any = { customer: { equals: String(customer.id) } }
    if (statuses.length) where.status = { in: statuses }

    const res = await req.payload.find({
      collection: 'orders',
      where,
      sort: '-createdAt',
      depth: 0,
      limit: 100,
      overrideAccess: true,
    })
    return json(res.docs.map((o) => toOrderDTO(req, o)))
  },
}

// GET /api/v1/orders/:orderId  — chi tiết đơn, chỉ chủ đơn (FR-049/050).
const getOrderConfig: Endpoint = {
  path: '/v1/orders/:orderId',
  method: 'get',
  handler: async (req) => {
    const customer = await getCustomer(req)
    if (!customer) return unauthorized()
    const orderId = param(req, 'orderId')
    if (!orderId) return notFound()
    const { order, error } = await loadOwnedOrder(req, orderId, String(customer.id))
    if (error) return error
    return json(toOrderDTO(req, order))
  },
}

// GET /api/v1/orders/:orderId/status-history  — lịch sử trạng thái (FR-050, AC-052).
const orderStatusHistoryConfig: Endpoint = {
  path: '/v1/orders/:orderId/status-history',
  method: 'get',
  handler: async (req) => {
    const customer = await getCustomer(req)
    if (!customer) return unauthorized()
    const orderId = param(req, 'orderId')
    if (!orderId) return notFound()
    const { order, error } = await loadOwnedOrder(req, orderId, String(customer.id))
    if (error) return error
    const statusHistory = (Array.isArray(order.statusHistory) ? order.statusHistory : []).map(
      (h: any) => ({
        status: h.status ?? '',
        label: ORDER_STATUS_LABELS[h.status as OrderStatus] ?? String(h.status ?? ''),
        at: h.at ?? null,
      }),
    )
    return json({ statusHistory })
  },
}

// POST /api/v1/orders/:orderId/reorder  — dựng lại giỏ từ đơn cũ (FR-051, ALT-001/002/003).
const reorderConfig: Endpoint = {
  path: '/v1/orders/:orderId/reorder',
  method: 'post',
  handler: async (req) => {
    const customer = await getCustomer(req)
    if (!customer) return unauthorized()
    const orderId = param(req, 'orderId')
    if (!orderId) return notFound()
    const { order, error } = await loadOwnedOrder(req, orderId, String(customer.id))
    if (error) return error

    const storeId = relId(order.store)
    const orderItems = (Array.isArray(order.items) ? order.items : [])
      .map((it: any) => ({
        productId: String(it.productId ?? ''),
        title: it.title ?? '',
        quantity: it.quantity ?? 1,
      }))
      .filter((it: any) => it.productId)

    // Tình trạng hiện tại của từng SP (ngừng KD = không tìm thấy; hết hàng = inStock/inventory).
    const availability: Record<string, ReorderAvailability> = {}
    await Promise.all(
      orderItems.map(async (it: any) => {
        try {
          const p: any = await req.payload.findByID({
            collection: 'products',
            id: it.productId,
            depth: 0,
            overrideAccess: true,
          })
          const inventory = p.inventory ?? 0
          const inStock = typeof p.inStock === 'boolean' ? p.inStock : inventory > 0
          availability[it.productId] = {
            exists: true,
            inStock,
            inventory,
            price: p.price ?? 0,
            title: p.title,
          }
        } catch {
          availability[it.productId] = { exists: false, inStock: false, inventory: 0, price: 0 }
        }
      }),
    )

    const { lines, skipped } = planReorder(orderItems, availability)
    // ALT-003: tất cả SP không khả dụng → không tạo giỏ.
    if (!lines.length) {
      return json({ error: 'Tất cả sản phẩm trong đơn không còn khả dụng', skipped }, 409)
    }

    // Dựng lại giỏ của (customer, store): thay toàn bộ item bằng các dòng khả dụng.
    const existing = await req.payload.find({
      collection: 'carts',
      where: {
        and: [{ customer: { equals: String(customer.id) } }, { store: { equals: storeId } }],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const items = lines.map((l) => ({
      product: l.productId,
      quantity: l.quantity,
      priceSnapshot: l.priceSnapshot,
    }))
    let cartId: string
    if (existing.docs[0]) {
      cartId = String(existing.docs[0].id)
      await req.payload.update({ collection: 'carts', id: cartId, overrideAccess: true, data: { items } })
    } else {
      const created = await req.payload.create({
        collection: 'carts',
        overrideAccess: true,
        data: { customer: String(customer.id), store: storeId, items },
      })
      cartId = String(created.id)
    }
    const fresh = await req.payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 2,
      overrideAccess: true,
    })
    return json({ cart: toCartDTO(req, fresh), skipped, storeId })
  },
}

// Thứ tự: path cụ thể hơn (/status-history, /reorder) khác method/độ sâu nên không đụng /orders/:orderId.
export const orderEndpoints: Endpoint[] = [
  shippingEstimateConfig,
  createOrderConfig,
  listOrdersConfig,
  getOrderConfig,
  orderStatusHistoryConfig,
  reorderConfig,
]
