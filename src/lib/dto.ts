import type { PayloadRequest } from 'payload'

import { ORDER_STATUS_LABELS, type OrderStatus } from './order'

/** Origin của request hiện tại (để dựng URL ảnh tuyệt đối). */
function origin(req: PayloadRequest): string {
  const fromEnv = process.env.SERVER_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  try {
    return new URL(req.url ?? '').origin
  } catch {
    return 'http://localhost:3000'
  }
}

function absUrl(req: PayloadRequest, url?: string | null): string | null {
  if (!url) return null
  if (/^https?:\/\//.test(url)) return url
  return `${origin(req)}${url}`
}

/** Lấy URL ảnh từ media (đã populate). preferCard=true ưu tiên bản resize 640. */
export function mediaUrl(
  req: PayloadRequest,
  media: unknown,
  preferCard = true,
): string | null {
  if (!media || typeof media !== 'object') return null
  const m = media as { url?: string; sizes?: { card?: { url?: string } } }
  const url = preferCard ? m.sizes?.card?.url || m.url : m.url
  return absUrl(req, url ?? null)
}

/** Trích plain text từ richText lexical. */
export function richToText(rt: unknown): string {
  const root = (rt as { root?: { children?: unknown[] } })?.root
  if (!root?.children) return ''
  const walk = (node: any): string => {
    if (!node) return ''
    if (typeof node.text === 'string') return node.text
    const inner = Array.isArray(node.children) ? node.children.map(walk).join('') : ''
    return node.type === 'paragraph' ? inner + '\n' : inner
  }
  return root.children.map(walk).join('').trim()
}

export type CategoryDTO = { id: string; name: string; image: string | null }

export function toCategoryDTO(req: PayloadRequest, doc: any): CategoryDTO {
  return { id: String(doc.id), name: doc.title, image: mediaUrl(req, doc.image) }
}

export type ProductDTO = {
  id: string
  sku: string
  name: string
  price: number
  originalPrice: number | null
  image: string | null
  images: string[]
  category: CategoryDTO | null
  detail: string
  inStock: boolean
  inventory: number
}

export function toProductDTO(req: PayloadRequest, doc: any): ProductDTO {
  const firstCat =
    Array.isArray(doc.categories) && typeof doc.categories[0] === 'object'
      ? toCategoryDTO(req, doc.categories[0])
      : null
  const images = Array.isArray(doc.gallery)
    ? doc.gallery.map((g: any) => mediaUrl(req, g.image)).filter((u: string | null): u is string => !!u)
    : []
  return {
    id: String(doc.id),
    sku: doc.sku ?? '',
    name: doc.title,
    price: doc.price ?? 0,
    originalPrice: doc.compareAtPrice ?? null,
    image: images[0] ?? null,
    images,
    category: firstCat,
    detail: richToText(doc.description),
    inStock: typeof doc.inStock === 'boolean' ? doc.inStock : (doc.inventory ?? 0) > 0,
    inventory: doc.inventory ?? 0,
  }
}

export type CustomerDTO = {
  id: string
  zaloId: string
  name: string
  avatar: string
  phone: string
  email: string
  address: string
  defaultStoreId: string | null
}

export function toCustomerDTO(_req: PayloadRequest, doc: any): CustomerDTO {
  const ds = doc.defaultStore
  return {
    id: String(doc.id),
    zaloId: String(doc.zaloId ?? ''),
    name: doc.name ?? '',
    avatar: doc.avatar ?? '',
    phone: doc.phone ?? '',
    email: doc.email ?? '',
    address: doc.address ?? '',
    defaultStoreId: ds ? String(typeof ds === 'object' ? ds.id : ds) : null,
  }
}

export type CartItemDTO = { product: ProductDTO; quantity: number; lineTotal: number }
export type CartDTO = {
  id: string
  storeId: string | null
  items: CartItemDTO[]
  subtotal: number
  totalItems: number
}

/** Map cart doc (items.product đã populate) → DTO cho FE. lineTotal theo giá hiện hành. */
export function toCartDTO(req: PayloadRequest, cart: any): CartDTO {
  const rawItems = Array.isArray(cart?.items) ? cart.items : []
  const items: CartItemDTO[] = rawItems
    .filter((it: any) => it?.product && typeof it.product === 'object')
    .map((it: any) => {
      const product = toProductDTO(req, it.product)
      const quantity = it.quantity ?? 1
      return { product, quantity, lineTotal: product.price * quantity }
    })
  return {
    id: String(cart?.id ?? ''),
    storeId: cart?.store
      ? String(typeof cart.store === 'object' ? cart.store.id : cart.store)
      : null,
    items,
    subtotal: items.reduce((s, it) => s + it.lineTotal, 0),
    totalItems: items.reduce((s, it) => s + it.quantity, 0),
  }
}

export type OrderDTO = {
  id: string
  orderCode: string
  status: string
  statusLabel: string
  paymentMethod: string
  paymentStatus: string
  items: {
    productId: string
    title: string
    sku: string
    price: number
    quantity: number
    lineTotal: number
  }[]
  delivery: { type: string; name: string; phone: string; address: string; stationId: string }
  note: string
  subtotal: number
  discount: number
  shippingFee: number
  total: number
  createdAt: string | null
  statusHistory: { status: string; at: string | null }[]
  zpOrderId: string | null
  zpTransId: string | null
  paidAt: string | null
}

export function toOrderDTO(_req: PayloadRequest, o: any): OrderDTO {
  const d = o?.delivery ?? {}
  const status = (o?.status ?? 'pending_confirm') as OrderStatus
  return {
    id: String(o?.id ?? ''),
    orderCode: o?.orderCode ?? '',
    status,
    statusLabel: ORDER_STATUS_LABELS[status] ?? String(status),
    paymentMethod: o?.paymentMethod ?? 'cod',
    paymentStatus: o?.paymentStatus ?? 'unpaid',
    items: (Array.isArray(o?.items) ? o.items : []).map((it: any) => ({
      productId: String(it.productId ?? ''),
      title: it.title ?? '',
      sku: it.sku ?? '',
      price: it.price ?? 0,
      quantity: it.quantity ?? 0,
      lineTotal: it.lineTotal ?? 0,
    })),
    delivery: {
      type: d.type ?? 'shipping',
      name: d.name ?? '',
      phone: d.phone ?? '',
      address: d.address ?? '',
      stationId: d.stationId ?? '',
    },
    note: o?.note ?? '',
    subtotal: o?.subtotal ?? 0,
    discount: o?.discount ?? 0,
    shippingFee: o?.shippingFee ?? 0,
    total: o?.total ?? 0,
    createdAt: o?.createdAt ?? null,
    statusHistory: (Array.isArray(o?.statusHistory) ? o.statusHistory : []).map((h: any) => ({
      status: h.status ?? '',
      at: h.at ?? null,
    })),
    zpOrderId: o?.zpOrderId ?? null,
    zpTransId: o?.zpTransId ?? null,
    paidAt: o?.paidAt ?? null,
  }
}

export function toStoreDTO(req: PayloadRequest, doc: any) {
  return {
    id: String(doc.id),
    name: doc.name,
    address: doc.address ?? null,
    phone: doc.phone ?? null,
    logo: mediaUrl(req, doc.logo, false),
    banners: Array.isArray(doc.banners)
      ? doc.banners.map((b: any) => mediaUrl(req, b.image, false)).filter(Boolean)
      : [],
    deliveryMethods: doc.deliveryMethods ?? [],
  }
}
