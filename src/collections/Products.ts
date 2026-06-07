import type { CollectionConfig } from 'payload'

import { slugField } from '../fields/slug'

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'price', 'inStock', 'store'],
    group: 'Sản phẩm',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    {
      name: 'gallery',
      type: 'array',
      labels: { singular: 'Ảnh', plural: 'Thư viện ảnh' },
      fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }],
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'Giá bán (VND).' },
    },
    {
      name: 'compareAtPrice',
      type: 'number',
      min: 0,
      admin: { description: 'Giá gốc (VND) — để hiển thị % giảm. Bỏ trống nếu không giảm giá.' },
    },
    { name: 'description', type: 'richText' },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'store',
      type: 'relationship',
      relationTo: 'stores',
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'inventory',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { position: 'sidebar', description: 'Tồn kho khả dụng.' },
    },
    {
      name: 'inStock',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Còn hàng / Hết hàng (FR-019).' },
    },
  ],
}
