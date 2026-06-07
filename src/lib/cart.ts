// Logic giỏ hàng THUẦN (không phụ thuộc Payload) — dễ unit test (FR-021..024).

export interface CartLine {
  productId: string
  quantity: number
  priceSnapshot: number
}

/** Tổng tiền hàng theo giá tại thời điểm thêm (priceSnapshot). */
export function cartSubtotal(lines: { priceSnapshot: number; quantity: number }[]): number {
  return lines.reduce((sum, l) => sum + l.priceSnapshot * l.quantity, 0)
}

/**
 * Kiểm tra số lượng sau thao tác không vượt tồn kho (BR-05.04, AC-025).
 * resultingQty là TỔNG số lượng dòng đó sau khi thêm/cập nhật.
 */
export function withinStock(inventory: number, resultingQty: number): boolean {
  return resultingQty >= 0 && resultingQty <= inventory
}

/** Số lượng hiện có của 1 sản phẩm trong giỏ (0 nếu chưa có). */
export function currentQty(lines: CartLine[], productId: string): number {
  return lines.find((l) => l.productId === productId)?.quantity ?? 0
}

/** Thêm vào giỏ: cộng dồn nếu đã có dòng, ngược lại tạo dòng mới (bất biến). */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const idx = lines.findIndex((l) => l.productId === line.productId)
  if (idx === -1) return [...lines, { ...line }]
  const next = lines.slice()
  next[idx] = {
    ...next[idx],
    quantity: next[idx].quantity + line.quantity,
    priceSnapshot: line.priceSnapshot,
  }
  return next
}

/** Đặt số lượng tuyệt đối cho 1 dòng; quantity<=0 → xóa dòng (FR-022). */
export function setLineQuantity(
  lines: CartLine[],
  productId: string,
  quantity: number,
): CartLine[] {
  if (quantity <= 0) return removeLine(lines, productId)
  return lines.map((l) => (l.productId === productId ? { ...l, quantity } : l))
}

/** Xóa 1 dòng khỏi giỏ (FR-023). */
export function removeLine(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((l) => l.productId !== productId)
}
