import type { CollectionConfig } from 'payload'

import { slugField } from '../fields/slug'

export const Stores: CollectionConfig = {
  slug: 'stores',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'address', 'isActive'],
    group: 'Cửa hàng',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'address', type: 'text' },
    { name: 'phone', type: 'text' },
    {
      name: 'location',
      type: 'group',
      admin: { description: 'Toạ độ cửa hàng (phục vụ gợi ý cửa hàng gần nhất ở giai đoạn sau).' },
      fields: [
        { name: 'lat', type: 'number' },
        { name: 'lng', type: 'number' },
      ],
    },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      name: 'banners',
      type: 'array',
      labels: { singular: 'Banner', plural: 'Banners' },
      fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }],
    },
    {
      name: 'deliveryMethods',
      type: 'select',
      hasMany: true,
      defaultValue: ['shipping', 'pickup'],
      options: [
        { label: 'Giao tận nơi', value: 'shipping' },
        { label: 'Tự đến lấy', value: 'pickup' },
      ],
    },
    { name: 'isActive', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
  ],
}
