import { describe, expect, it } from 'vitest'

import {
  CartLine,
  addLine,
  cartSubtotal,
  currentQty,
  removeLine,
  setLineQuantity,
  withinStock,
} from './cart'

const L = (productId: string, quantity: number, priceSnapshot = 10000): CartLine => ({
  productId,
  quantity,
  priceSnapshot,
})

describe('cartSubtotal (FR-024)', () => {
  it('tổng = Σ(price × qty)', () => {
    expect(cartSubtotal([L('a', 2, 10000), L('b', 1, 5000)])).toBe(25000)
  })
  it('giỏ rỗng → 0', () => {
    expect(cartSubtotal([])).toBe(0)
  })
})

describe('withinStock (BR-05.04, AC-025)', () => {
  it('cho phép khi ≤ tồn kho', () => {
    expect(withinStock(10, 10)).toBe(true)
    expect(withinStock(10, 3)).toBe(true)
  })
  it('chặn khi vượt tồn kho', () => {
    expect(withinStock(5, 6)).toBe(false)
  })
  it('chặn số lượng âm', () => {
    expect(withinStock(5, -1)).toBe(false)
  })
})

describe('addLine (FR-021)', () => {
  it('thêm dòng mới khi chưa có', () => {
    const next = addLine([], L('a', 1))
    expect(next).toHaveLength(1)
    expect(next[0].quantity).toBe(1)
  })
  it('cộng dồn khi đã có dòng (bất biến)', () => {
    const before = [L('a', 1)]
    const next = addLine(before, L('a', 2))
    expect(next[0].quantity).toBe(3)
    expect(before[0].quantity).toBe(1) // không mutate gốc
  })
})

describe('currentQty', () => {
  it('trả số lượng hiện có / 0 nếu chưa có', () => {
    expect(currentQty([L('a', 4)], 'a')).toBe(4)
    expect(currentQty([L('a', 4)], 'b')).toBe(0)
  })
})

describe('setLineQuantity (FR-022) & removeLine (FR-023)', () => {
  it('đặt số lượng tuyệt đối', () => {
    expect(setLineQuantity([L('a', 1)], 'a', 5)[0].quantity).toBe(5)
  })
  it('quantity<=0 → xóa dòng (AC-030: xóa item cuối → giỏ trống)', () => {
    expect(setLineQuantity([L('a', 1)], 'a', 0)).toHaveLength(0)
  })
  it('removeLine bỏ đúng dòng', () => {
    expect(removeLine([L('a', 1), L('b', 2)], 'a')).toEqual([L('b', 2)])
  })
})
