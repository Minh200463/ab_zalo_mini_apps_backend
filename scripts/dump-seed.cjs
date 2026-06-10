// Dump dữ liệu thật từ MongoDB → file fixture JSON để seed/restore lại sau này.
// Giữ nguyên _id (string) nên quan hệ giữa các collection + tham chiếu media S3 vẫn khớp.
const path = require('node:path')
const fs = require('node:fs')
const { MongoClient, BSON } = require(
  path.resolve(__dirname, '../node_modules/.pnpm/mongodb@6.20.0/node_modules/mongodb'),
)
const { EJSON } = BSON

const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8')
const URI = env.match(/DATABASE_URI=(.*)/)[1].trim()
const DB = URI.match(/\.net\/([^?]+)/)[1]

// Các collection thuộc "catalog" cần seed lại. Không đụng orders/customers/carts/users.
const COLLECTIONS = ['media', 'stores', 'categories', 'products']

;(async () => {
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })
  await client.connect()
  const db = client.db(DB)
  const out = {}
  for (const name of COLLECTIONS) {
    const docs = await db.collection(name).find({}).toArray()
    out[name] = docs
    console.log(`${name}: ${docs.length}`)
  }
  const dir = path.resolve(__dirname, 'fixtures')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'seed-data.json')
  // EJSON giữ nguyên kiểu BSON ($oid cho ObjectId, $date cho Date) → restore khớp quan hệ.
  fs.writeFileSync(file, EJSON.stringify(out, null, 2, { relaxed: false }), 'utf8')
  console.log('Đã ghi:', file, `(${(fs.statSync(file).size / 1024).toFixed(1)} KB)`)
  await client.close()
})().catch((e) => {
  console.error('ERR:', e.message)
  process.exit(1)
})
