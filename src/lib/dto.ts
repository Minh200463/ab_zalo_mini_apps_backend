import type { PayloadRequest } from 'payload'

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
