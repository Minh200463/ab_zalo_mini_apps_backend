import type { CollectionConfig } from 'payload'

// Hồ sơ khách hàng map từ tài khoản Zalo (FR-001).
// Mỗi Zalo User ID chỉ ứng với 1 hồ sơ (zaloId unique → AC-003 không tạo trùng).
// KHÔNG dùng `auth: true` (đó là tài khoản email/password cho admin) — phiên đăng nhập
// của khách dùng session token tự ký (src/lib/session.ts), cấp qua /api/v1/auth/zalo.
export const Customers: CollectionConfig = {
  slug: 'customers',
  access: {
    // Chỉ admin (đã đăng nhập Users) mới đọc/sửa qua REST mặc định.
    // Các endpoint /api/v1/customers/* dùng Local API (overrideAccess) nên không bị chặn.
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phone', 'zaloId', 'defaultStore'],
    group: 'Khách hàng',
  },
  fields: [
    { name: 'zaloId', type: 'text', required: true, unique: true, index: true },
    { name: 'name', type: 'text' },
    { name: 'avatar', type: 'text', admin: { description: 'URL ảnh đại diện Zalo' } },
    { name: 'phone', type: 'text' },
    { name: 'email', type: 'text' },
    { name: 'address', type: 'text' },
    {
      name: 'defaultStore',
      type: 'relationship',
      relationTo: 'stores',
      admin: { description: 'Cửa hàng mặc định của khách (FR-005).' },
    },
  ],
}
