import type { CollectionConfig } from 'payload'

import { slugField } from '../fields/slug'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'store', 'order'],
    group: 'Danh mục',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      name: 'store',
      type: 'relationship',
      relationTo: 'stores',
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'order',
      type: 'number',
      admin: { position: 'sidebar', description: 'Thứ tự hiển thị (nhỏ → trước).' },
    },
  ],
}
