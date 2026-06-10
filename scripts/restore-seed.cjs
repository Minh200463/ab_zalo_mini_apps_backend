// Khôi phục catalog (media/stores/categories/products) từ fixture seed-data.json.
// Giữ nguyên _id + quan hệ (ObjectId) + ngày tháng (Date) nhờ EJSON.
//
// Dùng:
//   node scripts/restore-seed.cjs           # chỉ nạp khi stores đang RỖNG (an toàn, idempotent)
//   node scripts/restore-seed.cjs --force   # XOÁ media/stores/categories/products rồi nạp lại từ fixture
//
// KHÔNG đụng tới orders/customers/carts/users. Ảnh thật nằm trên S3, media doc giữ
// nguyên _id nên ảnh vẫn hiển thị (miễn là object S3 còn).
const path = require('node:path')
const fs = require('node:fs')
const { MongoClient, BSON } = require(
  path.resolve(__dirname, '../node_modules/.pnpm/mongodb@6.20.0/node_modules/mongodb'),
)
const { EJSON } = BSON

const FORCE = process.argv.includes('--force')
const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8')
const URI = env.match(/DATABASE_URI=(.*)/)[1].trim()
const DB = URI.match(/\.net\/([^?]+)/)[1]

// Thứ tự nạp: media trước (stores/products tham chiếu tới), rồi stores → categories → products.
const ORDER = ['media', 'stores', 'categories', 'products']

;(async () => {
  const fixtureFile = path.resolve(__dirname, 'fixtures/seed-data.json')
  const data = EJSON.parse(fs.readFileSync(fixtureFile, 'utf8'), { relaxed: false })

  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })
  await client.connect()
  const db = client.db(DB)

  const storeCount = await db.collection('stores').countDocuments()
  if (storeCount > 0 && !FORCE) {
    console.log(`Đã có ${storeCount} stores. Bỏ qua. Dùng --force để xoá & nạp lại.`)
    await client.close()
    return
  }

  if (FORCE) {
    for (const name of [...ORDER].reverse()) {
      const { deletedCount } = await db.collection(name).deleteMany({})
      console.log(`xoá ${name}: ${deletedCount}`)
    }
  }

  for (const name of ORDER) {
    const docs = data[name] || []
    if (docs.length) {
      await db.collection(name).insertMany(docs, { ordered: false })
    }
    console.log(`nạp ${name}: ${docs.length}`)
  }

  console.log('Khôi phục xong.')
  await client.close()
})().catch((e) => {
  console.error('ERR:', e.message)
  process.exit(1)
})
