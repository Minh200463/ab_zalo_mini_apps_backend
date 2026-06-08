// Logic đơn hàng THUẦN (không phụ thuộc Payload) — dễ unit test (FR-025, FR-042, FR-043).

// Vòng đời trạng thái đơn (BR-09.02).
export const ORDER_STATUSES = [
  'pending_confirm', // Chờ xác nhận
  'confirmed', // Đã xác nhận
  'shipping', // Đang giao hàng
  'delivered', // Đã giao hàng
  'completed', // Hoàn thành
  'cancelled', // Đã hủy
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_confirm: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao hàng',
  delivered: 'Đã giao hàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

export const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'failed'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_METHODS = ['cod', 'zalopay'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * Tổng thanh toán = Tiền hàng − Giảm giá + Phí giao hàng (BR-08.01, AC-048).
 * Không âm; giảm giá bị giới hạn ≤ tiền hàng (AC-037, NFR-07).
 */
export function orderTotal(input: {
  subtotal: number
  discount?: number
  shippingFee?: number
}): number {
  const subtotal = Math.max(0, input.subtotal)
  const discount = Math.min(Math.max(0, input.discount ?? 0), subtotal)
  const shippingFee = Math.max(0, input.shippingFee ?? 0)
  return subtotal - discount + shippingFee
}

/** Phí giao hàng theo khoảng cách (FR-025). pickup = 0; không rõ khoảng cách → mức mặc định. */
export function shippingFeeByDistance(
  km: number | null | undefined,
  type: 'shipping' | 'pickup' = 'shipping',
): number {
  if (type === 'pickup') return 0
  if (km == null || Number.isNaN(km)) return 30000
  if (km < 3) return 15000
  if (km < 7) return 25000
  return 35000
}

// Nhóm trạng thái cho các tab màn Đơn hàng (FR-048). FE lọc server-side theo nhóm.
export const ORDER_STATUS_GROUPS: Record<'processing' | 'shipping' | 'history', OrderStatus[]> = {
  processing: ['pending_confirm', 'confirmed'],
  shipping: ['shipping', 'delivered'],
  history: ['completed', 'cancelled'],
}

export type ReorderSkipReason = 'discontinued' | 'out_of_stock'

export interface ReorderAvailability {
  exists: boolean
  inStock: boolean
  inventory: number
  price: number
  title?: string
}

export interface ReorderResult {
  lines: { productId: string; quantity: number; priceSnapshot: number }[]
  skipped: { productId: string; title: string; reason: ReorderSkipReason }[]
}

/**
 * Lập lại giỏ từ đơn cũ (FR-051): bỏ SP ngừng kinh doanh / hết hàng (ALT-001/002/003).
 * availability: map productId → tình trạng hiện tại; số lượng được kẹp ≤ tồn kho hiện có.
 * Hàm THUẦN để unit test (lines rỗng ⇒ caller không tạo giỏ).
 */
export function planReorder(
  orderItems: { productId: string; title?: string; quantity: number }[],
  availability: Record<string, ReorderAvailability>,
): ReorderResult {
  const lines: ReorderResult['lines'] = []
  const skipped: ReorderResult['skipped'] = []
  for (const it of orderItems) {
    const a = availability[it.productId]
    const title = it.title ?? a?.title ?? ''
    if (!a || !a.exists) {
      skipped.push({ productId: it.productId, title, reason: 'discontinued' })
      continue
    }
    if (!a.inStock || a.inventory <= 0) {
      skipped.push({ productId: it.productId, title, reason: 'out_of_stock' })
      continue
    }
    const quantity = Math.min(Math.max(1, it.quantity), a.inventory)
    lines.push({ productId: it.productId, quantity, priceSnapshot: a.price })
  }
  return { lines, skipped }
}

/** Sinh mã đơn duy nhất (BR-04.05). now=Date.now(), rand=Math.random() — truyền vào để test thuần. */
export function genOrderCode(now: number, rand: number): string {
  const t = Math.floor(now).toString(36).toUpperCase()
  const r = Math.floor(Math.abs(rand) * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0')
  return `OD${t}${r}`
}
