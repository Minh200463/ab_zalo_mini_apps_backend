import type { Endpoint, PayloadRequest } from 'payload'

import { toCategoryDTO, toProductDTO, toStoreDTO } from '../lib/dto'

const json = (data: unknown, status = 200) => Response.json(data, { status })
const notFound = (msg = 'Not found') => json({ error: msg }, 404)

const param = (req: PayloadRequest, key: string): string | undefined =>
  (req.routeParams?.[key] as string | undefined) ?? undefined

const queryStr = (req: PayloadRequest, key: string): string | undefined => {
  const v = req.query?.[key]
  return Array.isArray(v) ? String(v[0]) : v != null ? String(v) : undefined
}

async function findStoreOr404(req: PayloadRequest) {
  const id = param(req, 'storeId')
  if (!id) return null
  try {
    return await req.payload.findByID({ collection: 'stores', id, depth: 1 })
  } catch {
    return null
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// GET /api/v1/stores  — danh sách cửa hàng đang hoạt động (FR-003, FR-004)
const storesListConfig: Endpoint = {
  path: '/v1/stores',
  method: 'get',
  handler: async (req) => {
    const result = await req.payload.find({
      collection: 'stores',
      where: { isActive: { equals: true } },
      depth: 1,
      limit: 100,
    })
    return json(result.docs.map((d) => toStoreDTO(req, d)))
  },
}

// GET /api/v1/stores/nearest?lat=&lng=  — sắp xếp theo khoảng cách (FR-003)
const storesNearestConfig: Endpoint = {
  path: '/v1/stores/nearest',
  method: 'get',
  handler: async (req) => {
    const lat = Number(queryStr(req, 'lat'))
    const lng = Number(queryStr(req, 'lng'))
    const result = await req.payload.find({
      collection: 'stores',
      where: { isActive: { equals: true } },
      depth: 1,
      limit: 100,
    })
    let stores = result.docs.map((d) => toStoreDTO(req, d))
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      stores = stores
        .map((s: any, i: number) => {
          const loc = (result.docs[i] as any).location
          const distanceKm =
            loc?.lat != null && loc?.lng != null
              ? haversineKm(lat, lng, loc.lat, loc.lng)
              : null
          return { ...s, distanceKm }
        })
        .sort((a: any, b: any) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    }
    return json(stores)
  },
}

// GET /api/v1/stores/:storeId
const storeConfig: Endpoint = {
  path: '/v1/stores/:storeId',
  method: 'get',
  handler: async (req) => {
    const store = await findStoreOr404(req)
    if (!store) return notFound('Store not found')
    return json(toStoreDTO(req, store))
  },
}

// GET /api/v1/stores/:storeId/banners
const bannersConfig: Endpoint = {
  path: '/v1/stores/:storeId/banners',
  method: 'get',
  handler: async (req) => {
    const store = await findStoreOr404(req)
    if (!store) return notFound('Store not found')
    return json(toStoreDTO(req, store).banners)
  },
}

// GET /api/v1/stores/:storeId/categories
const categoriesConfig: Endpoint = {
  path: '/v1/stores/:storeId/categories',
  method: 'get',
  handler: async (req) => {
    const storeId = param(req, 'storeId')
    if (!storeId) return notFound('Store not found')
    const result = await req.payload.find({
      collection: 'categories',
      where: { store: { equals: storeId } },
      sort: 'order',
      depth: 1,
      limit: 100,
    })
    return json(result.docs.map((d) => toCategoryDTO(req, d)))
  },
}

// GET /api/v1/stores/:storeId/categories/:categoryId/products  (phân trang)
const productsByCategoryConfig: Endpoint = {
  path: '/v1/stores/:storeId/categories/:categoryId/products',
  method: 'get',
  handler: async (req) => {
    const storeId = param(req, 'storeId')
    const categoryId = param(req, 'categoryId')
    if (!storeId || !categoryId) return notFound()
    const page = Number(queryStr(req, 'page')) || 1
    const limit = Number(queryStr(req, 'limit')) || 20
    const result = await req.payload.find({
      collection: 'products',
      where: { and: [{ store: { equals: storeId } }, { categories: { in: [categoryId] } }] },
      depth: 2,
      page,
      limit,
    })
    return json({
      docs: result.docs.map((d) => toProductDTO(req, d)),
      page: result.page,
      totalPages: result.totalPages,
      totalDocs: result.totalDocs,
      hasNextPage: result.hasNextPage,
    })
  },
}

// GET /api/v1/stores/:storeId/products/search?q=&page=&limit=   (đặt TRƯỚC :productId)
const searchConfig: Endpoint = {
  path: '/v1/stores/:storeId/products/search',
  method: 'get',
  handler: async (req) => {
    const storeId = param(req, 'storeId')
    if (!storeId) return notFound()
    const q = (queryStr(req, 'q') ?? '').trim()
    const page = Number(queryStr(req, 'page')) || 1
    const limit = Number(queryStr(req, 'limit')) || 20
    const where: any = q
      ? { and: [{ store: { equals: storeId } }, { title: { like: q } }] }
      : { store: { equals: storeId } }
    const result = await req.payload.find({ collection: 'products', where, depth: 2, page, limit })
    return json({
      docs: result.docs.map((d) => toProductDTO(req, d)),
      page: result.page,
      totalPages: result.totalPages,
      totalDocs: result.totalDocs,
      hasNextPage: result.hasNextPage,
    })
  },
}

// GET /api/v1/stores/:storeId/products/:productId
const productDetailConfig: Endpoint = {
  path: '/v1/stores/:storeId/products/:productId',
  method: 'get',
  handler: async (req) => {
    const storeId = param(req, 'storeId')
    const productId = param(req, 'productId')
    if (!storeId || !productId) return notFound()
    try {
      const doc = await req.payload.findByID({ collection: 'products', id: productId, depth: 2 })
      const docStoreId = typeof doc.store === 'object' ? doc.store?.id : doc.store
      if (String(docStoreId) !== String(storeId)) return notFound('Product not in store')
      return json(toProductDTO(req, doc))
    } catch {
      return notFound('Product not found')
    }
  },
}

// Thứ tự quan trọng:
// - /v1/stores và /v1/stores/nearest đứng TRƯỚC /v1/stores/:storeId
// - search đứng trước productDetail để "search" không bị bắt như :productId
export const catalogEndpoints: Endpoint[] = [
  storesListConfig,
  storesNearestConfig,
  storeConfig,
  bannersConfig,
  categoriesConfig,
  productsByCategoryConfig,
  searchConfig,
  productDetailConfig,
]
