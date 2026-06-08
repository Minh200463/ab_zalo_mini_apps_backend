import { describe } from 'vitest'
import type { Payload } from 'payload'

/**
 * Helper khởi tạo Payload Local API cho integration test (P0.1).
 *
 * Dùng DB TEST riêng để KHÔNG đụng dữ liệu thật:
 *   - đặt env `TEST_DATABASE_URI` (vd Atlas DB `zalo_miniapp_test`).
 *   - test integration tự SKIP nếu thiếu env này (xem `describeIntegration`).
 *
 * Mỗi suite tạo gì phải tự xóa (chuẩn self-contained) — dùng `clearCollections`.
 */
export const hasTestDb = Boolean(process.env.TEST_DATABASE_URI)

/** describe chỉ chạy khi có DB test, ngược lại skip (giữ `pnpm test` xanh offline). */
export const describeIntegration = describe.skipIf(!hasTestDb)

let cached: Payload | null = null

export async function getTestPayload(): Promise<Payload> {
  if (cached) return cached
  // Trỏ DB sang TEST trước khi import config (config đọc DATABASE_URI lúc build).
  process.env.DATABASE_URI = process.env.TEST_DATABASE_URI
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  cached = await getPayload({ config })
  return cached
}

/** Xóa sạch các collection chỉ định (gọi trong afterAll để dọn dữ liệu test). */
export async function clearCollections(payload: Payload, slugs: string[]): Promise<void> {
  for (const slug of slugs) {
    await payload.delete({ collection: slug as any, where: {}, overrideAccess: true })
  }
}
