import type { CollectionConfig } from 'payload'

import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../lib/order'

const statusOptions = ORDER_STATUSES.map((s) => ({ label: s, value: s }))

// Đơn hàng (FR-042, FR-048..051). Tạo qua endpoint /api/v1/orders; admin xem/cập nhật trạng thái.
export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    read: ({ req }) => !!req.user, // khách đọc qua endpoint /orders/:id (kiểm tra chủ đơn)
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  admin: {
    useAsTitle: 'orderCode',
    defaultColumns: ['orderCode', 'customer', 'store', 'status', 'paymentStatus', 'total'],
    group: 'Khách hàng',
  },
  fields: [
    { name: 'orderCode', type: 'text', unique: true, index: true, required: true },
    { name: 'customer', type: 'relationship', relationTo: 'customers', required: true, index: true },
    { name: 'store', type: 'relationship', relationTo: 'stores', required: true, index: true },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'productId', type: 'text' },
        { name: 'title', type: 'text' },
        { name: 'sku', type: 'text' },
        { name: 'price', type: 'number' },
        { name: 'quantity', type: 'number' },
        { name: 'lineTotal', type: 'number' },
      ],
    },
    {
      name: 'delivery',
      type: 'group',
      fields: [
        {
          name: 'type',
          type: 'select',
          options: [
            { label: 'Giao tận nơi', value: 'shipping' },
            { label: 'Tự đến lấy', value: 'pickup' },
          ],
          defaultValue: 'shipping',
        },
        { name: 'name', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'stationId', type: 'text' },
      ],
    },
    { name: 'note', type: 'text' },
    { name: 'subtotal', type: 'number', defaultValue: 0 },
    { name: 'discount', type: 'number', defaultValue: 0 },
    { name: 'shippingFee', type: 'number', defaultValue: 0 },
    { name: 'total', type: 'number', defaultValue: 0 },
    {
      name: 'paymentMethod',
      type: 'select',
      options: PAYMENT_METHODS.map((m) => ({ label: m, value: m })),
      defaultValue: 'cod',
    },
    {
      name: 'paymentStatus',
      type: 'select',
      options: PAYMENT_STATUSES.map((s) => ({ label: s, value: s })),
      defaultValue: 'unpaid',
    },
    {
      name: 'status',
      type: 'select',
      options: statusOptions,
      defaultValue: 'pending_confirm',
      index: true,
    },
    // Thanh toán ZaloPay — fields lưu kết quả từ Checkout SDK callback (P10).
    { name: 'zpOrderId', type: 'text', index: true, admin: { description: 'orderId từ Checkout SDK' } },
    { name: 'zpTransId', type: 'text', admin: { description: 'transId từ callback' } },
    { name: 'paidAt', type: 'date', admin: { description: 'Thời gian thanh toán thành công' } },
    {
      name: 'statusHistory',
      type: 'array',
      fields: [
        { name: 'status', type: 'select', options: statusOptions },
        { name: 'at', type: 'date' },
      ],
    },
  ],
}
