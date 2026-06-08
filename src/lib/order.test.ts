import { describe, expect, it } from 'vitest'

import {
  ORDER_STATUS_GROUPS,
  type ReorderAvailability,
  genOrderCode,
  orderTotal,
  planReorder,
  shippingFeeByDistance,
} from './order'

describe('orderTotal (BR-08.01, AC-048, NFR-07)', () => {
  it('tổng = tiền hàng − giảm + phí ship', () => {
    expect(orderTotal({ subtotal: 100000, discount: 20000, shippingFee: 15000 })).toBe(95000)
  })
  it('không giảm/không ship → = tiền hàng', () => {
    expect(orderTotal({ subtotal: 50000 })).toBe(50000)
  })
  it('giảm giá bị giới hạn ≤ tiền hàng (AC-037, không âm)', () => {
    expect(orderTotal({ subtotal: 30000, discount: 999999, shippingFee: 0 })).toBe(0)
  })
})

describe('shippingFeeByDistance (FR-025)', () => {
  it('pickup → 0', () => {
    expect(shippingFeeByDistance(100, 'pickup')).toBe(0)
  })
  it('theo bậc khoảng cách', () => {
    expect(shippingFeeByDistance(1, 'shipping')).toBe(15000)
    expect(shippingFeeByDistance(5, 'shipping')).toBe(25000)
    expect(shippingFeeByDistance(20, 'shipping')).toBe(35000)
  })
  it('không rõ khoảng cách → mức mặc định', () => {
    expect(shippingFeeByDistance(null, 'shipping')).toBe(30000)
  })
})

describe('ORDER_STATUS_GROUPS (FR-048)', () => {
  it('mỗi nhóm gồm đúng các trạng thái', () => {
    expect(ORDER_STATUS_GROUPS.processing).toEqual(['pending_confirm', 'confirmed'])
    expect(ORDER_STATUS_GROUPS.shipping).toEqual(['shipping', 'delivered'])
    expect(ORDER_STATUS_GROUPS.history).toEqual(['completed', 'cancelled'])
  })
})

describe('planReorder (FR-051, ALT-001/002/003)', () => {
  const avail = (
    o: Partial<ReorderAvailability> & Pick<ReorderAvailability, 'exists'>,
  ): ReorderAvailability => ({ inStock: true, inventory: 10, price: 1000, ...o })

  it('giữ SP còn hàng, kẹp số lượng ≤ tồn kho, dùng giá hiện hành', () => {
    const res = planReorder(
      [{ productId: 'a', title: 'A', quantity: 5 }],
      { a: avail({ exists: true, inventory: 3, price: 2000 }) },
    )
    expect(res.lines).toEqual([{ productId: 'a', quantity: 3, priceSnapshot: 2000 }])
    expect(res.skipped).toEqual([])
  })

  it('bỏ SP ngừng kinh doanh (không tồn tại) — reason discontinued (ALT-001/002)', () => {
    const res = planReorder([{ productId: 'x', title: 'X', quantity: 1 }], {})
    expect(res.lines).toHaveLength(0)
    expect(res.skipped[0]).toMatchObject({ productId: 'x', reason: 'discontinued' })
  })

  it('bỏ SP hết hàng — reason out_of_stock (ALT-003)', () => {
    const res = planReorder(
      [{ productId: 'b', title: 'B', quantity: 2 }],
      { b: avail({ exists: true, inStock: false, inventory: 0 }) },
    )
    expect(res.lines).toHaveLength(0)
    expect(res.skipped[0]).toMatchObject({ productId: 'b', reason: 'out_of_stock' })
  })

  it('tất cả không khả dụng → lines rỗng (caller KHÔNG tạo giỏ)', () => {
    const res = planReorder(
      [
        { productId: 'a', title: 'A', quantity: 1 },
        { productId: 'b', title: 'B', quantity: 1 },
      ],
      { b: avail({ exists: true, inventory: 0, inStock: false }) },
    )
    expect(res.lines).toHaveLength(0)
    expect(res.skipped).toHaveLength(2)
  })
})

describe('genOrderCode (BR-04.05)', () => {
  it('tiền tố OD + xác định theo (now, rand)', () => {
    expect(genOrderCode(1000, 0.5)).toBe(genOrderCode(1000, 0.5))
    expect(genOrderCode(1000, 0.5).startsWith('OD')).toBe(true)
  })
  it('now khác nhau → mã khác nhau', () => {
    expect(genOrderCode(1000, 0.5)).not.toBe(genOrderCode(2000, 0.5))
  })
})
