import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
  ],
  upload: {
    // Các kích thước resize cơ bản cho mobile (NFR-14). Mở rộng ở Phase 2 nếu cần.
    imageSizes: [
      { name: 'thumbnail', width: 300, height: 300, position: 'centre' },
      { name: 'card', width: 640, height: 640, position: 'centre' },
    ],
    mimeTypes: ['image/*'],
  },
}
