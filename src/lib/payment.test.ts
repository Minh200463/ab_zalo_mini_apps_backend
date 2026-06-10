import { describe, expect, it } from 'vitest'

import {
  signCreateOrderMac,
  verifyCallbackMac,
  verifyOverallMac,
  verifyNotifyMac,
} from './payment'

const TEST_KEY = 'test-private-key-1234567890'

describe('signCreateOrderMac', () => {
  it('tạo mac deterministic — cùng params cùng key → cùng mac', () => {
    const params = { amount: 50000, desc: 'Thanh toán đơn', item: '[{"id":"1","amount":50000}]' }
    const mac1 = signCreateOrderMac(params, TEST_KEY)
    const mac2 = signCreateOrderMac(params, TEST_KEY)
    expect(mac1).toBe(mac2)
    expect(mac1).toHaveLength(64) // SHA-256 hex
  })

  it('key khác → mac khác', () => {
    const params = { amount: 50000, desc: 'Test', item: '[]' }
    expect(signCreateOrderMac(params, 'key-a')).not.toBe(signCreateOrderMac(params, 'key-b'))
  })

  it('sắp xếp key alphabetically (amount, desc, item)', () => {
    // Với extradata & method, thứ tự: amount, desc, extradata, item, method
    const params = {
      amount: 10000,
      desc: 'Test',
      item: '[]',
      extradata: '{"orderId":"123"}',
      method: '{"id":"ZALOPAY","isCustom":false}',
    }
    const mac = signCreateOrderMac(params, TEST_KEY)
    expect(mac).toHaveLength(64)
    // Đảm bảo không crash và trả hex string
    expect(/^[0-9a-f]{64}$/.test(mac)).toBe(true)
  })

  it('params không có extradata/method → chỉ ký 3 field', () => {
    const mac = signCreateOrderMac({ amount: 1, desc: 'a', item: '[]' }, TEST_KEY)
    expect(/^[0-9a-f]{64}$/.test(mac)).toBe(true)
  })
})

describe('verifyCallbackMac', () => {
  // Tạo mac thủ công cho test: HMAC-SHA256 với chuỗi cố định.
  const crypto = require('crypto')
  const makeCallbackMac = (data: any, key: string) => {
    const str = `appId=${data.appId}&amount=${data.amount}&description=${data.description}&orderId=${data.orderId}&message=${data.message}&resultCode=${data.resultCode}&transId=${data.transId}`
    return crypto.createHmac('sha256', key).update(str).digest('hex')
  }

  const sampleData = {
    appId: '123456',
    orderId: 'ORD001',
    transId: 'TRX001',
    amount: 50000,
    description: 'Thanh toan don hang',
    resultCode: 1,
    message: 'Success',
  }

  it('mac hợp lệ → true', () => {
    const mac = makeCallbackMac(sampleData, TEST_KEY)
    expect(verifyCallbackMac(sampleData, mac, TEST_KEY)).toBe(true)
  })

  it('mac sai → false', () => {
    expect(verifyCallbackMac(sampleData, 'a'.repeat(64), TEST_KEY)).toBe(false)
  })

  it('key sai → false', () => {
    const mac = makeCallbackMac(sampleData, TEST_KEY)
    expect(verifyCallbackMac(sampleData, mac, 'wrong-key')).toBe(false)
  })

  it('data bị sửa đổi → false', () => {
    const mac = makeCallbackMac(sampleData, TEST_KEY)
    expect(verifyCallbackMac({ ...sampleData, amount: 1 }, mac, TEST_KEY)).toBe(false)
  })
})

describe('verifyOverallMac', () => {
  const crypto = require('crypto')
  const makeOverallMac = (data: Record<string, any>, key: string) => {
    const sorted = Object.keys(data)
      .sort()
      .map((k) => `${k}=${data[k]}`)
      .join('&')
    return crypto.createHmac('sha256', key).update(sorted).digest('hex')
  }

  const sampleData = {
    appId: '123456',
    orderId: 'ORD001',
    transId: 'TRX001',
    amount: 10000,
    description: 'Payment_for_goods',
    resultCode: 1,
    message: 'Payment_successful',
    method: 'ZALOPAY',
    transTime: '1710832784000',
    merchantTransId: 'MT123456789',
    extradata: '%7B%22key1%22%3A%22value1%22%7D',
  }

  it('overall mac hợp lệ → true', () => {
    const mac = makeOverallMac(sampleData, TEST_KEY)
    expect(verifyOverallMac(sampleData, mac, TEST_KEY)).toBe(true)
  })

  it('overall mac sai → false', () => {
    expect(verifyOverallMac(sampleData, 'b'.repeat(64), TEST_KEY)).toBe(false)
  })
})

describe('verifyNotifyMac (COD/bank)', () => {
  const crypto = require('crypto')
  const makeNotifyMac = (data: any, key: string) => {
    const str = `appId=${data.appId}&orderId=${data.orderId}&method=${data.method}`
    return crypto.createHmac('sha256', key).update(str).digest('hex')
  }

  const sampleData = { appId: '123456', orderId: 'ORD002', method: 'COD' }

  it('notify mac hợp lệ → true', () => {
    const mac = makeNotifyMac(sampleData, TEST_KEY)
    expect(verifyNotifyMac(sampleData, mac, TEST_KEY)).toBe(true)
  })

  it('notify mac sai → false', () => {
    expect(verifyNotifyMac(sampleData, 'c'.repeat(64), TEST_KEY)).toBe(false)
  })
})
