import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Stores } from './collections/Stores'
import { Categories } from './collections/Categories'
import { Products } from './collections/Products'
import { Customers } from './collections/Customers'
import { Carts } from './collections/Carts'
import { Orders } from './collections/Orders'
import { seedEndpoint } from './endpoints/seed'
import { catalogEndpoints } from './endpoints/catalog'
import { authEndpoints } from './endpoints/auth'
import { cartEndpoints } from './endpoints/cart'
import { orderEndpoints } from './endpoints/orders'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '- AntD2C',
    },
    components: {
      graphics: {
        Logo: '/components/Branding#Logo',
        Icon: '/components/Branding#Icon',
      },
    },
  },
  collections: [Users, Media, Stores, Categories, Products, Customers, Carts, Orders],
  endpoints: [
    seedEndpoint,
    ...catalogEndpoints,
    ...authEndpoints,
    ...cartEndpoints,
    ...orderEndpoints,
  ],
  cors: '*',
  plugins: [
    // Lưu ảnh lên S3 KHI có cấu hình S3_BUCKET; nếu không (dev local) dùng ổ đĩa.
    // Chỉ nạp plugin khi có bucket — `enabled:false` vẫn chiếm route file nên dùng cách include có điều kiện.
    ...(process.env.S3_BUCKET
      ? [
          s3Storage({
            // prefix: mọi file nằm trong zalo-miniapp/media/ → cô lập, không đụng dữ liệu khác trong bucket dùng chung.
            collections: { media: { prefix: 'zalo-miniapp/media' } },
            bucket: process.env.S3_BUCKET,
            config: {
              region: process.env.S3_REGION,
              ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
              forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
              },
            },
          }),
        ]
      : []),
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  sharp,
})
