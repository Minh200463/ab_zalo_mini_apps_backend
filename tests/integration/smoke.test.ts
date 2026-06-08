import { afterAll, expect, it } from 'vitest'

import { describeIntegration, getTestPayload } from '../helpers/payload'

// Smoke integration: chỉ chạy khi có TEST_DATABASE_URI (offline → skip).
describeIntegration('Payload Local API (smoke)', () => {
  afterAll(async () => {
    // Không tạo dữ liệu nào ở suite này nên không cần dọn.
  })

  it('khởi tạo được Payload instance', async () => {
    const payload = await getTestPayload()
    expect(payload).toBeTruthy()
    expect(typeof payload.find).toBe('function')
  })
})
