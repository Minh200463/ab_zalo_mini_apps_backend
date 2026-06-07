import { describe, expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'

import { mediaUrl, richToText, toCartDTO, toCategoryDTO, toProductDTO } from './dto'

// Fake request đủ để dựng URL tuyệt đối (dto chỉ đọc req.url).
const req = { url: 'http://localhost:3001/api/v1/x' } as unknown as PayloadRequest

describe('richToText', () => {
  it('trích plain text từ richText lexical, nối paragraph bằng xuống dòng', () => {
    const rt = {
      root: {
        children: [
          { type: 'paragraph', children: [{ text: 'Xin chào' }] },
          { type: 'paragraph', children: [{ text: 'thế giới' }] },
        ],
      },
    }
    expect(richToText(rt)).toBe('Xin chào\nthế giới')
  })

  it('trả chuỗi rỗng khi không có root/children', () => {
    expect(richToText(null)).toBe('')
    expect(richToText({})).toBe('')
  })
})

describe('mediaUrl', () => {
  it('ưu tiên bản resize card khi preferCard=true', () => {
    const media = { url: '/api/media/file/a.png', sizes: { card: { url: '/api/media/file/a-card.png' } } }
    expect(mediaUrl(req, media, true)).toBe('http://localhost:3001/api/media/file/a-card.png')
  })

  it('dùng url gốc khi preferCard=false', () => {
    const media = { url: '/api/media/file/a.png', sizes: { card: { url: '/x-card.png' } } }
    expect(mediaUrl(req, media, false)).toBe('http://localhost:3001/api/media/file/a.png')
  })

  it('giữ nguyên URL tuyệt đối; trả null khi media rỗng', () => {
    expect(mediaUrl(req, { url: 'https://cdn.example.com/b.png' })).toBe('https://cdn.example.com/b.png')
    expect(mediaUrl(req, null)).toBeNull()
  })
})

describe('toCategoryDTO', () => {
  it('map title→name, id→string', () => {
    const dto = toCategoryDTO(req, { id: 123, title: 'Rau củ', image: { url: '/c.png' } })
    expect(dto).toEqual({ id: '123', name: 'Rau củ', image: 'http://localhost:3001/c.png' })
  })
})

describe('toProductDTO', () => {
  const baseDoc = {
    id: 'p1',
    sku: 'SKU-DEMO-001',
    title: 'Táo Fuji',
    price: 45000,
    compareAtPrice: 60000,
    gallery: [{ image: { url: '/g1.png' } }, { image: { url: '/g2.png' } }],
    categories: [{ id: 'c1', title: 'Trái cây', image: { url: '/cat.png' } }],
    description: { root: { children: [{ type: 'paragraph', children: [{ text: 'Ngon' }] }] } },
  }

  it('map đầy đủ field FE; image = ảnh gallery đầu tiên', () => {
    const dto = toProductDTO(req, { ...baseDoc, inStock: true, inventory: 10 })
    expect(dto.id).toBe('p1')
    expect(dto.sku).toBe('SKU-DEMO-001')
    expect(dto.name).toBe('Táo Fuji')
    expect(dto.price).toBe(45000)
    expect(dto.originalPrice).toBe(60000)
    expect(dto.image).toBe('http://localhost:3001/g1.png')
    expect(dto.images).toHaveLength(2)
    expect(dto.category?.name).toBe('Trái cây')
    expect(dto.detail).toBe('Ngon')
    expect(dto.inStock).toBe(true)
    expect(dto.inventory).toBe(10)
  })

  it('sku rỗng khi doc không có sku', () => {
    const { sku, ...noSku } = baseDoc
    expect(toProductDTO(req, noSku).sku).toBe('')
  })

  it('suy ra inStock từ inventory khi field inStock không phải boolean', () => {
    expect(toProductDTO(req, { ...baseDoc, inventory: 5 }).inStock).toBe(true)
    expect(toProductDTO(req, { ...baseDoc, inventory: 0 }).inStock).toBe(false)
  })

  it('tôn trọng inStock=false dù inventory>0 (FR-019)', () => {
    expect(toProductDTO(req, { ...baseDoc, inStock: false, inventory: 99 }).inStock).toBe(false)
  })
})

describe('toCartDTO (FR-024)', () => {
  const prod = (id: string, price: number) => ({
    id,
    title: `SP ${id}`,
    price,
    gallery: [],
    categories: [],
  })

  it('tính subtotal/totalItems theo giá hiện hành; bỏ qua item product chưa populate', () => {
    const cart = {
      id: 'cart1',
      store: 'store-1',
      items: [
        { product: prod('a', 10000), quantity: 2 },
        { product: prod('b', 5000), quantity: 1 },
        { product: 'unpopulated-id', quantity: 9 }, // bị lọc
      ],
    }
    const dto = toCartDTO(req, cart)
    expect(dto.storeId).toBe('store-1')
    expect(dto.items).toHaveLength(2)
    expect(dto.items[0].lineTotal).toBe(20000)
    expect(dto.subtotal).toBe(25000)
    expect(dto.totalItems).toBe(3)
  })

  it('giỏ rỗng → subtotal 0', () => {
    expect(toCartDTO(req, { id: 'c', store: 'store-1', items: [] }).subtotal).toBe(0)
  })
})
