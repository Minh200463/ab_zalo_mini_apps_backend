# AntBuddy Zalo Mini App Backend

Backend cho Zalo Mini App thuong mai dien tu AntBuddy, xay dung tren Payload CMS 3, Next.js 15 va MongoDB.

## Tong quan

Du an cung cap:

- Admin CMS Payload de quan ly cua hang, danh muc, san pham, khach hang, gio hang va don hang.
- API `/api/v1` cho Zalo Mini App doc catalog, xac thuc khach hang, quan ly gio hang va dat hang.
- Seed endpoint de tao du lieu mau cho moi truong dev.
- Test tu dong voi Vitest cho cart, order, DTO, session va smoke test.

## Yeu cau

- Node.js `>=20.9.0`
- pnpm `^9` hoac `^10`
- MongoDB connection string

## Cai dat

```bash
pnpm install
```

Tao file `.env` tu `.env.example`:

```bash
cp .env.example .env
```

Cau hinh toi thieu:

```env
DATABASE_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/zalo_miniapp?appName=Cluster0
PAYLOAD_SECRET=<random-secret>
```

S3 la tuy chon. Neu khong cau hinh `S3_BUCKET`, media se duoc luu local.

## Chay local

```bash
pnpm dev
```

Mac dinh app chay o:

- Frontend/Next: `http://localhost:3001`
- Payload Admin: `http://localhost:3001/admin`
- API: `http://localhost:3001/api`

## Scripts

```bash
pnpm dev                 # chay Next dev server port 3001
pnpm build               # build production
pnpm start               # chay production server
pnpm test                # chay test mot lan
pnpm test:watch          # chay test watch mode
pnpm generate:types      # generate Payload types
pnpm generate:importmap  # generate Payload import map
pnpm payload             # chay Payload CLI
```

## Collections

- `Users`
- `Media`
- `Stores`
- `Categories`
- `Products`
- `Customers`
- `Carts`
- `Orders`

## API chinh

Auth va customer:

- `POST /api/v1/auth/zalo`
- `GET /api/v1/customers/me`
- `PATCH /api/v1/customers/me`
- `PATCH /api/v1/customers/me/default-store`

Catalog:

- `GET /api/v1/stores`
- `GET /api/v1/stores/nearest`
- `GET /api/v1/stations`
- `GET /api/v1/stores/:storeId`
- `GET /api/v1/stores/:storeId/banners`
- `GET /api/v1/stores/:storeId/categories`
- `GET /api/v1/stores/:storeId/categories/:categoryId/products`
- `GET /api/v1/stores/:storeId/products/search`
- `GET /api/v1/stores/:storeId/products/:productId`
- `GET /api/v1/stores/:storeId/products/:productId/inventory`

Cart:

- `GET /api/v1/carts/me`
- `POST /api/v1/carts/me/items`
- `PATCH /api/v1/carts/me/items/:productId`
- `DELETE /api/v1/carts/me/items/:productId`
- `DELETE /api/v1/carts/me`

Orders:

- `POST /api/v1/shipping/estimate`
- `POST /api/v1/orders`
- `GET /api/v1/customers/me/orders`
- `GET /api/v1/orders/:orderId`
- `GET /api/v1/orders/:orderId/status-history`
- `POST /api/v1/orders/:orderId/reorder`

Seed:

- `POST /api/seed`
- `POST /api/seed?force=1`

## Smoke test

File `API_SMOKE.http` co san cac request mau de chay bang REST Client trong VS Code.

Luu y: file hien tai co `@base = http://localhost:3000/api/v1`; neu dang chay bang `pnpm dev`, hay doi thanh `http://localhost:3001/api/v1`.

## Kiem tra truoc khi push

```bash
pnpm test
pnpm build
```
