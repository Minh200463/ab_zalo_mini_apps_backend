import type { Endpoint, PayloadRequest } from 'payload'

import { toCartDTO } from '../lib/dto'
import { getCustomer, json, notFound, queryStr, readBody, unauthorized } from '../lib/req'
import {
  CartLine,
  addLine,
  currentQty,
  removeLine,
  setLineQuantity,
  withinStock,
} from '../lib/cart'

const param = (req: PayloadRequest, key: string): string | undefined =>
  (req.routeParams?.[key] as string | undefined) ?? undefined

const storeIdOf = (doc: any): string =>
  String(typeof doc?.store === 'object' ? doc.store?.id : doc?.store)

/** Tìm giỏ (customer, store); null nếu chưa có. depth=2 để populate product cho DTO. */
async function findCart(req: PayloadRequest, customerId: string, storeId: string, depth = 2) {
  const res = await req.payload.find({
    collection: 'carts',
    where: { and: [{ customer: { equals: customerId } }, { store: { equals: storeId } }] },
    depth,
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] ?? null
}

/** Chuẩn hoá items của cart doc → CartLine[] (product có thể là id hoặc object). */
function normalizeLines(cart: any): CartLine[] {
  return (Array.isArray(cart?.items) ? cart.items : []).map((it: any) => ({
    productId: String(typeof it.product === 'object' ? it.product?.id : it.product),
    quantity: it.quantity ?? 1,
    priceSnapshot: it.priceSnapshot ?? 0,
  }))
}

/** Ghi lại items + trả về cart DTO (đọc lại depth=2 để populate product). */
async function writeAndReturn(req: PayloadRequest, cartId: string, lines: CartLine[]) {
  await req.payload.update({
    collection: 'carts',
    id: cartId,
    overrideAccess: true,
    data: {
      items: lines.map((l) => ({
        product: l.productId,
        quantity: l.quantity,
        priceSnapshot: l.priceSnapshot,
      })),
    },
  })
  const fresh = await req.payload.findByID({
    collection: 'carts',
    id: cartId,
    depth: 2,
    overrideAccess: true,
  })
  return json(toCartDTO(req, fresh))
}

const emptyCartDTO = (storeId: string | null) =>
  json({ id: '', storeId, items: [], subtotal: 0, totalItems: 0 })

// GET /api/v1/carts/me?storeId=  — giỏ hàng theo store hiện hành (FR-024).
const cartGetConfig: Endpoint = {
  path: '/v1/carts/me',
  method: 'get',
  handler: async (req) => {
    const customer = await getCustomer(req)
    if (!customer) return unauthorized()
    const ds = (customer as any).defaultStore
    const defaultStoreId = ds ? String(typeof ds === 'object' ? ds.id : ds) : ''
    const storeId = queryStr(req, 'storeId') || defaultStoreId
    if (!storeId) return emptyCartDTO(null)
    const cart = await findCart(req, String(customer.id), storeId)
    return cart ? json(toCartDTO(req, cart)) : emptyCartDTO(storeId)
  },
}

// POST /api/v1/carts/me/items  { productId, quantity }  — thêm vào giỏ (FR-021).
const cartAddItemConfig: Endpoint = {
  path: '/v1/carts/me/items',
  method: 'post',
  handler: async (req) => {
    const customer = await getCustomer(req)
    if (!customer) return unauthorized()
    const body = await readBody(req)
    const productId = String(body.productId ?? '').trim()
    const quantity = Math.max(1, Number(body.quantity) || 1)
    if (!productId) return json({ error: 'Thiếu productId' }, 400)

    let product: any
    try {
      product = await req.payload.findByID({ collection: 'products', id: productId, depth: 0 })
    } catch {
      return notFound('Product not found')
    }
    const storeId = storeIdOf(product) // giỏ thuộc store của sản phẩm → NFR-11 đảm bảo bằng cấu trúc
    const inventory = product.inventory ?? 0
    const inStock = typeof product.inStock === 'boolean' ? product.inStock : inventory > 0

    let cart = await findCart(req, String(customer.id), storeId)
    if (!cart) {
      cart = await req.payload.create({
        collection: 'carts',
        overrideAccess: true,
        data: { customer: String(customer.id), store: storeId, items: [] },
      })
    }
    const lines = normalizeLines(cart)
    const resultingQty = currentQty(lines, productId) + quantity
    // BR-05.02/05.04, AC-025: chặn thêm khi hết hàng hoặc vượt tồn kho.
    if (!inStock || !withinStock(inventory, resultingQty)) {
      return json(
        { error: 'Vượt quá tồn kho khả dụng', inventory, inStock },
        409,
      )
    }
    const next = addLine(lines, { productId, quantity, priceSnapshot: product.price ?? 0 })
    return writeAndReturn(req, String(cart.id), next)
  },
}

// PUT /api/v1/carts/me/items/:productId  { quantity }  — cập nhật số lượng (FR-022).
const cartUpdateItemConfig: Endpoint = {
  path: '/v1/carts/me/items/:productId',
  method: 'put',
  handler: async (req) => {
    const customer = await getCustomer(req)
    if (!customer) return unauthorized()
    const productId = param(req, 'productId')
    if (!productId) return notFound()
    const body = await readBody(req)
    const quantity = Number(body.quantity)
    if (Number.isNaN(quantity)) return json({ error: 'Thiếu quantity' }, 400)

    let product: any
    try {
      product = await req.payload.findByID({ collection: 'products', id: productId, depth: 0 })
    } catch {
      return notFound('Product not found')
    }
    const storeId = storeIdOf(product)
    const cart = await findCart(req, String(customer.id), storeId)
    if (!cart) return notFound('Cart not found')

    const inventory = product.inventory ?? 0
    if (quantity > 0 && !withinStock(inventory, quantity)) {
      return json({ error: 'Vượt quá tồn kho khả dụng', inventory }, 409)
    }
    const next = setLineQuantity(normalizeLines(cart), productId, quantity)
    return writeAndReturn(req, String(cart.id), next)
  },
}

// DELETE /api/v1/carts/me/items/:productId  — xóa sản phẩm khỏi giỏ (FR-023).
const cartRemoveItemConfig: Endpoint = {
  path: '/v1/carts/me/items/:productId',
  method: 'delete',
  handler: async (req) => {
    const customer = await getCustomer(req)
    if (!customer) return unauthorized()
    const productId = param(req, 'productId')
    if (!productId) return notFound()

    let product: any
    try {
      product = await req.payload.findByID({ collection: 'products', id: productId, depth: 0 })
    } catch {
      return notFound('Product not found')
    }
    const cart = await findCart(req, String(customer.id), storeIdOf(product))
    if (!cart) return notFound('Cart not found')
    const next = removeLine(normalizeLines(cart), productId)
    return writeAndReturn(req, String(cart.id), next)
  },
}

// DELETE /api/v1/carts/me?storeId=  — làm mới (xóa) giỏ của store (FR-004).
const cartClearConfig: Endpoint = {
  path: '/v1/carts/me',
  method: 'delete',
  handler: async (req) => {
    const customer = await getCustomer(req)
    if (!customer) return unauthorized()
    const storeId = queryStr(req, 'storeId') || ''
    if (!storeId) return json({ error: 'Thiếu storeId' }, 400)
    const cart = await findCart(req, String(customer.id), storeId, 0)
    if (cart) {
      await req.payload.delete({ collection: 'carts', id: String(cart.id), overrideAccess: true })
    }
    return emptyCartDTO(storeId)
  },
}

// Thứ tự: /items/:productId (PUT/DELETE) là path riêng method; /carts/me GET vs DELETE khác method.
export const cartEndpoints: Endpoint[] = [
  cartGetConfig,
  cartClearConfig,
  cartAddItemConfig,
  cartUpdateItemConfig,
  cartRemoveItemConfig,
]
