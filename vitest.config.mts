import { defineConfig } from 'vitest/config'

// Test harness backend (P0.1). Unit test chạy offline (hàm thuần);
// integration test (Payload Local API) tự skip nếu thiếu TEST_DATABASE_URI.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Integration test mở Payload + Mongo có thể lâu hơn mặc định.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
