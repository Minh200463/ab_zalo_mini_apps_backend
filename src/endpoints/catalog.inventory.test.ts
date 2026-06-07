import { describe, expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'

import { inventoryConfig } from './catalog'

// Dựng req giả: chỉ cần routeParams + payload.findByID (mock) cho handler tồn kho.
function makeReq(doc: any, params = { storeId: 'store-1', productId: 'p1' }): PayloadRequest {
  return {
    url: 'http://localhost:3001/api/v1/x',
    routeParams: params,
    query: {},
    payload: {
      findByID: async () => {
        if (doc === null) throw new Error('not found')
        return doc
      },
    },
  } as unknown as PayloadRequest
}

const call = async (req: PayloadRequest) => {
  const res = (await inventoryConfig.handler(req as any)) as Response
  return { status: res.status, body: await res.json() }
}

describe('GET .../products/:productId/inventory (FR-020)', () => {
  it('inventory>0 → inStock true (AC-021)', async () => {
    const { status, body } = await call(makeReq({ store: 'store-1', inventory: 12, inStock: true }))
    expect(status).toBe(200)
    expect(body).toEqual({ inStock: true, inventory: 12 })
  })

  it('inventory=0 → inStock false (AC-022)', async () => {
    const { status, body } = await call(makeReq({ store: 'store-1', inventory: 0, inStock: false }))
    expect(status).toBe(200)
    expect(body).toEqual({ inStock: false, inventory: 0 })
  })

  it('suy ra inStock từ inventory khi thiếu field inStock', async () => {
    const { body } = await call(makeReq({ store: 'store-1', inventory: 3 }))
    expect(body.inStock).toBe(true)
  })

  it('sản phẩm không thuộc store → 404', async () => {
    const { status } = await call(makeReq({ store: 'store-OTHER', inventory: 5 }))
    expect(status).toBe(404)
  })

  it('không tìm thấy sản phẩm → 404', async () => {
    const { status } = await call(makeReq(null))
    expect(status).toBe(404)
  })
})
