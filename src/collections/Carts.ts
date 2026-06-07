import type { CollectionConfig } from 'payload'

// Giỏ hàng server-side (FR-021..024). Mô hình: 1 giỏ / (customer, store) — NFR-11/BR-06.04
// đảm bảo bằng cấu trúc (mỗi cart chỉ chứa sản phẩm của 1 store); BR-06.05 (quay lại store
// cũ giữ nguyên giỏ) thỏa vì mỗi store có giỏ riêng. Truy cập qua endpoint /carts/me (bearer).
export const Carts: CollectionConfig = {
  slug: 'carts',
  access: {
    // Chỉ admin thao tác trực tiếp; endpoint khách dùng Local API (overrideAccess).
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['customer', 'store', 'updatedAt'],
    group: 'Khách hàng',
  },
  fields: [
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
    },
    {
      name: 'store',
      type: 'relationship',
      relationTo: 'stores',
      required: true,
      index: true,
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true },
        { name: 'quantity', type: 'number', required: true, min: 1 },
        { name: 'priceSnapshot', type: 'number', min: 0 },
      ],
    },
  ],
}
