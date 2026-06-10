// Logic thanh toán Zalo Mini App Checkout SDK THUẦN (không phụ thuộc Payload) — dễ unit test.
// Tham khảo: https://miniapp.zaloplatforms.com/documents/payment/createOrder/
//             https://miniapp.zaloplatforms.com/documents/payment/callback/
//             https://miniapp.zaloplatforms.com/documents/payment/notify/

import crypto from 'crypto'

// ─── Env helpers ───────────────────────────────────────────────
const PRIVATE_KEY = () => process.env.ZMP_PRIVATE_KEY || ''

// ─── MAC tạo đơn (createOrder) ─────────────────────────────────
// Docs: sắp xếp key alphabetically, join "key=value" với "&", HMAC-SHA256 bằng privateKey.
// extradata & method phải là JSON String. item phải là String.

export interface CreateOrderParams {
  amount: number
  desc: string
  item: string // JSON string của mảng [{id, amount}]
  extradata?: string // JSON string
  method?: string // JSON string: {"id":"ZALOPAY","isCustom":false}
}

/**
 * Tạo MAC cho `Payment.createOrder()` phía FE.
 * Thuật toán: sort keys alphabetically → join "key=value" bằng "&" → HMAC-SHA256.
 */
export function signCreateOrderMac(
  params: CreateOrderParams,
  privateKey?: string,
): string {
  const key = privateKey ?? PRIVATE_KEY()
  const data: Record<string, string | number> = {
    amount: params.amount,
    desc: params.desc,
    item: params.item,
  }
  if (params.extradata != null) data.extradata = params.extradata
  if (params.method != null) data.method = params.method
  return buildSortedMac(data, key)
}

// ─── Callback verification ─────────────────────────────────────
// Docs callback: "appId={appId}&amount={amount}&description={description}&orderId={orderId}
//                 &message={message}&resultCode={resultCode}&transId={transId}"
// resultCode: 1=thành công, -1=thất bại

export interface CallbackData {
  appId: string
  orderId: string
  transId: string
  amount: number
  description: string
  resultCode: number
  message: string
  method?: string
  extradata?: string
  transTime?: string
  merchantTransId?: string
}

/**
 * Verify mac cơ bản (7 field cố định) từ callback Checkout SDK.
 */
export function verifyCallbackMac(
  data: CallbackData,
  mac: string,
  privateKey?: string,
): boolean {
  const key = privateKey ?? PRIVATE_KEY()
  const dataStr = `appId=${data.appId}&amount=${data.amount}&description=${data.description}&orderId=${data.orderId}&message=${data.message}&resultCode=${data.resultCode}&transId=${data.transId}`
  const expected = crypto.createHmac('sha256', key).update(dataStr).digest('hex')
  return timingSafeCompare(expected, mac)
}

/**
 * Verify overallMac (toàn bộ field, sắp xếp alphabetically) — nên dùng khi có extradata/method.
 */
export function verifyOverallMac(
  data: Record<string, string | number>,
  overallMac: string,
  privateKey?: string,
): boolean {
  const key = privateKey ?? PRIVATE_KEY()
  const expected = buildSortedMac(data, key)
  return timingSafeCompare(expected, overallMac)
}

// ─── Notify verification (COD/bank) ────────────────────────────
// Docs: "appId={appId}&orderId={orderId}&method={method}"

export interface NotifyData {
  appId: string
  orderId: string
  method: string
}

/**
 * Verify mac cho notify request (COD / chuyển khoản).
 */
export function verifyNotifyMac(
  data: NotifyData,
  mac: string,
  privateKey?: string,
): boolean {
  const key = privateKey ?? PRIVATE_KEY()
  const dataStr = `appId=${data.appId}&orderId=${data.orderId}&method=${data.method}`
  const expected = crypto.createHmac('sha256', key).update(dataStr).digest('hex')
  return timingSafeCompare(expected, mac)
}

// ─── Hook cho sau khi thanh toán thành công ────────────────────
// Placeholder (D4 — CHƯA bắn OA); gọi tại callback handler sau khi set paid.

export async function notifyOrderPaid(order: any): Promise<void> {
  // TODO(D4): Ráp Zalo OA Template Message tại đây khi cần.
  console.log(`[payment] Order ${order?.orderCode ?? order?.id} marked as paid — OA notification skipped (D4)`)
}

// ─── Utilities ─────────────────────────────────────────────────

/** HMAC-SHA256 với keys sắp xếp alphabetically, join "key=value" bằng "&". */
function buildSortedMac(data: Record<string, string | number>, key: string): string {
  const sorted = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('&')
  return crypto.createHmac('sha256', key).update(sorted).digest('hex')
}

/** So sánh timing-safe 2 hex string (cùng encoding). */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}
