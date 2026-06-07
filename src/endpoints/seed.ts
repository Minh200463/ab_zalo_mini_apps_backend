import type { Endpoint, PayloadRequest } from 'payload'
import sharp from 'sharp'

type RGB = [number, number, number]

const FALLBACK: RGB = [203, 213, 225]

/** Ảnh đặc màu (fallback offline khi không tải được ảnh thật). */
async function solidPng(color: RGB): Promise<Buffer> {
  const [r, g, b] = color
  return sharp({ create: { width: 640, height: 640, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer()
}

/** Tải ảnh thật theo từ khóa (LoremFlickr — ảnh Flickr theo keyword, không cần API key). */
async function fetchImage(
  keywords: string,
  lock: number,
): Promise<{ data: Buffer; ext: string; mime: string } | null> {
  try {
    const url = `https://loremflickr.com/640/640/${encodeURIComponent(keywords)}?lock=${lock}`
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1000) return null // tránh ảnh lỗi/rỗng
    const mime = res.headers.get('content-type') || 'image/jpeg'
    const ext = mime.includes('png') ? 'png' : 'jpg'
    return { data: buf, ext, mime }
  } catch {
    return null
  }
}

async function createMedia(
  payload: PayloadRequest['payload'],
  name: string,
  keywords: string,
  lock: number,
): Promise<string> {
  const img = await fetchImage(keywords, lock)
  const file = img
    ? { name: `${name}.${img.ext}`, data: img.data, mimetype: img.mime, size: img.data.length }
    : await solidPng(FALLBACK).then((data) => ({
        name: `${name}.png`,
        data,
        mimetype: 'image/png',
        size: data.length,
      }))
  const doc = await payload.create({ collection: 'media', data: { alt: name }, file })
  return String(doc.id)
}

/** RichText lexical tối thiểu cho 1 đoạn văn. */
const richText = (text: string): any => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr' as const,
        children: [
          { type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 },
        ],
      },
    ],
  },
})

type ProductSeed = { name: string; kw: string; desc: string }
type CategorySeed = { title: string; kw: string; products: ProductSeed[] }
type StoreSeed = {
  name: string
  address: string
  phone: string
  location: { lat: number; lng: number }
  logoColor: RGB
  bannerKeywords: string[]
  catalog: CategorySeed[]
}

// 8 danh mục + 3 sản phẩm/danh mục, kèm từ khóa ảnh (tiếng Anh để LoremFlickr khớp nội dung).
const CATALOG: CategorySeed[] = [
  {
    title: 'Rau củ quả',
    kw: 'vegetables',
    products: [
      { name: 'Cà chua bi', kw: 'tomato', desc: 'Cà chua bi tươi, mọng nước.' },
      { name: 'Rau cải xanh', kw: 'cabbage,greens', desc: 'Rau cải xanh sạch theo ngày.' },
      { name: 'Cà rốt Đà Lạt', kw: 'carrot', desc: 'Cà rốt Đà Lạt giòn ngọt.' },
    ],
  },
  {
    title: 'Trái cây',
    kw: 'fruit',
    products: [
      { name: 'Táo Fuji', kw: 'apple', desc: 'Táo Fuji nhập khẩu, giòn ngọt.' },
      { name: 'Chuối tiêu', kw: 'banana', desc: 'Chuối tiêu chín cây.' },
      { name: 'Cam sành', kw: 'orange,citrus', desc: 'Cam sành nhiều nước.' },
    ],
  },
  {
    title: 'Thịt & Hải sản',
    kw: 'meat,seafood',
    products: [
      { name: 'Thịt ba chỉ', kw: 'pork,meat', desc: 'Thịt ba chỉ tươi.' },
      { name: 'Tôm sú', kw: 'shrimp,prawn', desc: 'Tôm sú size lớn.' },
      { name: 'Cá hồi phi lê', kw: 'salmon,fish', desc: 'Cá hồi phi lê tươi.' },
    ],
  },
  {
    title: 'Đồ uống',
    kw: 'beverage,drink',
    products: [
      { name: 'Nước cam ép', kw: 'orange-juice', desc: 'Nước cam ép nguyên chất.' },
      { name: 'Cà phê rang xay', kw: 'coffee', desc: 'Cà phê rang xay đậm vị.' },
      { name: 'Trà xanh', kw: 'green-tea,tea', desc: 'Trà xanh thanh mát.' },
    ],
  },
  {
    title: 'Bánh kẹo',
    kw: 'candy,snack',
    products: [
      { name: 'Bánh quy bơ', kw: 'cookie,biscuit', desc: 'Bánh quy bơ giòn tan.' },
      { name: 'Socola', kw: 'chocolate', desc: 'Socola đắng cao cấp.' },
      { name: 'Kẹo dẻo', kw: 'gummy,candy', desc: 'Kẹo dẻo trái cây.' },
    ],
  },
  {
    title: 'Gia vị',
    kw: 'spice',
    products: [
      { name: 'Muối biển', kw: 'salt', desc: 'Muối biển tinh khiết.' },
      { name: 'Tiêu đen', kw: 'pepper,peppercorn', desc: 'Tiêu đen nguyên hạt.' },
      { name: 'Nước mắm', kw: 'fish-sauce,sauce', desc: 'Nước mắm truyền thống.' },
    ],
  },
  {
    title: 'Đồ khô',
    kw: 'grain,dried-food',
    products: [
      { name: 'Gạo thơm', kw: 'rice', desc: 'Gạo thơm dẻo.' },
      { name: 'Mì sợi', kw: 'noodle,pasta', desc: 'Mì sợi dai ngon.' },
      { name: 'Đậu các loại', kw: 'beans,legume', desc: 'Đậu hạt các loại.' },
    ],
  },
  {
    title: 'Sữa & Trứng',
    kw: 'milk,dairy',
    products: [
      { name: 'Sữa tươi', kw: 'milk', desc: 'Sữa tươi thanh trùng.' },
      { name: 'Trứng gà', kw: 'eggs', desc: 'Trứng gà ta.' },
      { name: 'Sữa chua', kw: 'yogurt', desc: 'Sữa chua men sống.' },
    ],
  },
]

// Catalog khác cho cửa hàng thứ 2 (để thấy rõ "đổi store → đổi dữ liệu").
const CATALOG_B: CategorySeed[] = [
  {
    title: 'Trái cây nhập',
    kw: 'fruit',
    products: [
      { name: 'Dưa hấu', kw: 'watermelon', desc: 'Dưa hấu ruột đỏ.' },
      { name: 'Xoài cát', kw: 'mango', desc: 'Xoài cát Hòa Lộc.' },
    ],
  },
  {
    title: 'Nước giải khát',
    kw: 'beverage,drink',
    products: [
      { name: 'Nước suối', kw: 'water-bottle', desc: 'Nước suối tinh khiết.' },
      { name: 'Sữa đậu nành', kw: 'soy-milk', desc: 'Sữa đậu nành đóng chai.' },
    ],
  },
  {
    title: 'Ăn vặt',
    kw: 'snack',
    products: [
      { name: 'Snack khoai tây', kw: 'chips,snack', desc: 'Snack khoai tây giòn.' },
      { name: 'Bánh bông lan', kw: 'cake,sponge-cake', desc: 'Bánh bông lan trứng muối.' },
    ],
  },
  {
    title: 'Đồ ăn nhanh',
    kw: 'fast-food',
    products: [
      { name: 'Mì ly', kw: 'instant-noodle,noodle', desc: 'Mì ly ăn liền.' },
      { name: 'Xúc xích', kw: 'sausage', desc: 'Xúc xích tiệt trùng.' },
    ],
  },
]

const STORES: StoreSeed[] = [
  {
    name: 'AntBuddy Demo Store',
    address: 'Z06 Số 13, Tân Thuận Đông, Quận 7, Hồ Chí Minh',
    phone: '0912345678',
    location: { lat: 10.7384, lng: 106.7236 },
    logoColor: [13, 33, 55],
    bannerKeywords: ['supermarket,grocery', 'sale,discount', 'fresh,food'],
    catalog: CATALOG,
  },
  {
    name: 'AntBuddy Mini Mart',
    address: '12 Nguyễn Huệ, Bến Nghé, Quận 1, Hồ Chí Minh',
    phone: '0987654321',
    location: { lat: 10.7731, lng: 106.7042 },
    logoColor: [180, 50, 50],
    bannerKeywords: ['convenience-store,shop', 'snack,drink'],
    catalog: CATALOG_B,
  },
]

export const seedEndpoint: Endpoint = {
  path: '/seed',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const { payload } = req
    const force = req.query?.force === '1' || req.query?.force === 'true'

    const existing = await payload.count({ collection: 'stores' })
    if (existing.totalDocs > 0 && !force) {
      return Response.json(
        { skipped: true, message: 'Đã có dữ liệu. Dùng ?force=1 để seed lại.' },
        { status: 200 },
      )
    }

    // force=1: xoá sạch dữ liệu cũ để seed lại từ đầu (tránh trùng & đổi storeId lung tung).
    if (force) {
      for (const collection of ['products', 'categories', 'stores', 'media'] as const) {
        await payload.delete({ collection, where: { id: { exists: true } } })
      }
    }

    let lock = 1 // mỗi ảnh 1 lock khác nhau để LoremFlickr trả ảnh khác nhau
    let count = 0 // đếm media toàn cục để đặt tên file không trùng
    const summary: Array<{ storeId: string; name: string; categories: number; products: number }> =
      []

    for (let s = 0; s < STORES.length; s++) {
      const seed = STORES[s]

      // 1) Logo + banner cho cửa hàng
      const logoData = await solidPng(seed.logoColor)
      const logo = await payload.create({
        collection: 'media',
        data: { alt: `logo-${s + 1}` },
        file: {
          name: `logo-${s + 1}.png`,
          data: logoData,
          mimetype: 'image/png',
          size: logoData.length,
        },
      })
      const bannerIds: string[] = []
      for (let i = 0; i < seed.bannerKeywords.length; i++) {
        bannerIds.push(
          await createMedia(payload, `s${s + 1}-banner-${i + 1}`, seed.bannerKeywords[i], lock++),
        )
      }

      // 2) Store
      const store = await payload.create({
        collection: 'stores',
        data: {
          name: seed.name,
          address: seed.address,
          phone: seed.phone,
          location: seed.location,
          logo: String(logo.id),
          banners: bannerIds.map((image) => ({ image })),
          deliveryMethods: ['shipping', 'pickup'],
          isActive: true,
        },
      })
      const storeId = String(store.id)

      // 3) Categories + 4) Products theo catalog của cửa hàng
      let catCount = 0
      let prodCount = 0
      for (let c = 0; c < seed.catalog.length; c++) {
        const cat = seed.catalog[c]
        count++
        const catImageId = await createMedia(payload, `s${s + 1}-cat-${c + 1}`, cat.kw, lock++)
        const category = await payload.create({
          collection: 'categories',
          data: { title: cat.title, image: catImageId, store: storeId, order: c + 1 },
        })
        catCount++

        for (let p = 0; p < cat.products.length; p++) {
          count++
          const prodSeed = cat.products[p]
          const base = 15000 + count * 5000
          const hasDiscount = count % 3 === 0
          const outOfStock = count % 7 === 0
          const prodImageId = await createMedia(
            payload,
            `s${s + 1}-prod-${count}`,
            `${prodSeed.kw},food`,
            lock++,
          )
          await payload.create({
            collection: 'products',
            data: {
              title: prodSeed.name,
              gallery: [{ image: prodImageId }],
              price: base,
              ...(hasDiscount ? { compareAtPrice: base + 10000 } : {}),
              description: richText(prodSeed.desc),
              categories: [String(category.id)],
              store: storeId,
              inventory: outOfStock ? 0 : 50,
              inStock: !outOfStock,
            },
          })
          prodCount++
        }
      }

      summary.push({ storeId, name: seed.name, categories: catCount, products: prodCount })
    }

    return Response.json({ success: true, stores: summary })
  },
}
