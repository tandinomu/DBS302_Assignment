# ShopNest - Technical Report

**Student Name:** Tandin Om 

**Student Number:** 02230302

**Module:** DBS302 - NoSQL Database Management 

**Project:** ShopNest E-Commerce Platform  

**Date:** June 2, 2026  

**Student Email:** 02230302.cst@rub.edu.bt

---

## Abstract

ShopNest is a full-stack e-commerce platform that uses MongoDB and Redis together (polyglot persistence). A 3-node MongoDB replica set is the source of truth for products, orders, users, and inventory. It runs aggregation pipelines for analytics and multi-document ACID transactions for order placement. Redis, set up with Sentinel for high availability, handles the fast in-memory work: sessions, carts, trending leaderboards, rate-limit counters, and HyperLogLog visitor counts. This report explains the key decisions — embedding vs referencing, index choices, the cache-aside pattern with stampede protection, read/write concerns tied to the CAP theorem, and a sharding plan for scaling out.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT BROWSER                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (port 3000)                       │
│  pages/index.js  pages/products/[id].js  pages/cart.js              │
│  pages/checkout.js  pages/dashboard.js                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST API calls (Bearer JWT)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Express.js Backend (port 5000)                          │
│                                                                      │
│  /auth  /products  /cart  /orders  /users  /analytics               │
│                                                                      │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │   Redis Layer        │    │     MongoDB Layer                 │   │
│  │  (Cache-aside first) │    │  (Source of truth)               │   │
│  │                      │    │                                  │   │
│  │  session:{userId}    │    │  ┌──────────┐  ┌──────────────┐ │   │
│  │  cart:{userId}       │    │  │  mongo1  │  │   mongo2     │ │   │
│  │  product:{id}        │    │  │(PRIMARY) │  │(SECONDARY)   │ │   │
│  │  trending:products   │    │  └────┬─────┘  └──────────────┘ │   │
│  │  leaderboard:sellers │    │       │ rs0 replica set          │   │
│  │  hll:product:{id}    │    │  ┌────┴─────┐                   │   │
│  │  ratelimit:{ip}      │    │  │  mongo3  │                   │   │
│  └──────────────────────┘    │  │(SECONDARY│                   │   │
│                              │  └──────────┘                   │   │
│  Redis Sentinel HA:          └──────────────────────────────────┘   │
│    redis-sentinel1:26379                                             │
│    redis-sentinel2:26380     Collections: users, products, orders,  │
│    redis-sentinel3:26381     categories, reviews, inventory          │
│                                                                      │
│  redis-master:6379                                                   │
│  redis-replica1:6380                                                 │
│  redis-replica2:6381                                                 │
└─────────────────────────────────────────────────────────────────────┘

Request flow — GET /products/:id (cache-aside):
  Browser → Express → CHECK Redis product:{id}
    HIT  → Return immediately (≈2-10ms)
    MISS → Acquire lock → Query MongoDB → Store in Redis → Return (≈50-200ms)
```

---

## 2. Technology Selection Justification

### 2.1 Why MongoDB

**Flexible schema for varied products.** A laptop has RAM and a processor; a book has an ISBN and author. In SQL this needs either an EAV table (slow, messy joins) or one table per product type. MongoDB's `Schema.Types.Mixed` `attributes` field in `Product.js` stores any key-value pairs directly.

**The document model fits orders.** An order holds the user reference, an address snapshot, and all items in one document. Reading it is a single fetch by `_id` — no joins across 4–5 tables.

**Aggregation framework.** `$group`, `$unwind`, `$lookup`, `$match`, and `$project` express analytics queries directly in the database. The `monthlySalesReport`, `topProductsByRevenue`, `lowStockAlert`, and `viewsVsPurchasesAnalysis` pipelines use these — no separate analytics service needed.

**ACID transactions on a replica set.** Placing an order means checking inventory, decrementing stock, and creating the order atomically. A single-document write can't guarantee that. MongoDB's transactions with `writeConcern: { w: "majority", j: true }` can.

**Scales out.** It supports sharding when the data grows (plan in Section 10).

### 2.2 Why Redis

**Fast reads on hot paths.** A product fetch from MongoDB takes ~50–200ms (disk + network). Redis returns the same data in ~2–10ms (RAM). The benchmark in Section 6 measures this.

**A data structure for each job:**
- **Hash** → sessions and carts: edit one field with HGET/HSET, no full deserialize
- **Sorted Set** → trending and leaderboards: ZINCRBY and ZREVRANGE in O(log N)
- **List** → recently viewed: LPUSH + LTRIM keeps a fixed-length queue in O(1)
- **String** → rate limiting: INCR is atomic, so it never double-counts
- **HyperLogLog** → unique visitors: counts huge sets in 12KB (±0.81% error)

**TTLs.** Sessions expire in 24h, carts in 7 days. Product cache keys use a jittered TTL (±10%) so they don't all expire at once.

**Sentinel HA.** Three sentinels (quorum=2) watch the master and promote a replica if it dies. Requiring a quorum prevents split-brain.

### 2.3 Why Both Together

MongoDB and Redis solve different problems — they aren't competing:

| Concern | MongoDB | Redis |
|---------|---------|-------|
| Durable storage | ✓ (WiredTiger + journaling) | ✗ (primarily RAM) |
| Complex queries | ✓ (aggregation pipeline) | ✗ (limited query model) |
| ACID transactions | ✓ (replica set sessions) | Partial (MULTI/EXEC, not ACID) |
| Sub-ms reads | ✗ (disk-based) | ✓ (RAM-based) |
| Real-time counters | ✗ (document updates) | ✓ (INCR atomic) |
| Leaderboards | ✗ (requires sort + limit) | ✓ (sorted set native) |
| Session management | ✗ (heavy) | ✓ (HSET + EXPIRE) |

Using MongoDB alone would make sessions and leaderboards expensive. Using Redis alone would sacrifice persistence and query flexibility. The combination uses each tool where it excels.

---

## 3. Data Modeling

### 3.1 Collections and Embedding vs. Referencing Decisions

#### 3.1.1 User Collection

```json
{
  "name": "Carol Customer",
  "email": "carol@shopnest.com",
  "role": "customer",
  "addresses": [              ← EMBEDDED
    { "street": "42 Main St", "city": "Thimphu", "country": "Bhutan", "zip": "11001", "isDefault": true }
  ],
  "paymentPreferences": [     ← EMBEDDED
    { "method": "upi", "last4": null }
  ],
  "wishlist": ["<ObjectId>"]  ← REFERENCED (queried independently with $in)
}
```

**Embed `addresses`:** they're always read with the profile and used at checkout, never queried on their own. Embedding avoids a separate collection and a `$lookup` on every profile load.

**Reference `wishlist`:** product refs are resolved with an `$in` query on the wishlist page. Products change (price, reviews), so a reference always shows current data.

#### 3.1.2 Product Collection

```json
{
  "name": "ProBook X1 Laptop",
  "basePrice": 1299,
  "category": "<ObjectId>",     ← REFERENCED
  "attributes": {               ← Schema.Types.Mixed (polymorphic)
    "ram": "16GB",
    "storage": "512GB SSD",
    "processor": "Intel Core i7-1355U"
  },
  "variants": [                 ← EMBEDDED
    { "sku": "PROBOOK-STD", "color": "Black", "price": 1299, "stock": 45 }
  ],
  "ratings": { "average": 4.7, "count": 243 }  ← EMBEDDED
}
```

**`attributes` as Mixed:** stores arbitrary key-value pairs — a laptop has `ram`/`processor`, a book has `isbn`/`author`/`pages`. This is what MongoDB is good at, and it avoids the relational EAV anti-pattern.

**Embed `variants`:** always read with the product for display and add-to-cart. Referencing would mean 5 extra fetches for a product with 5 variants.

**Reference `category`:** categories are managed separately (CRUD), get renamed, and are browsed on their own. A reference keeps them DRY.

#### 3.1.3 Order Collection — Snapshot Pattern

```json
{
  "user": "<ObjectId>",
  "items": [
    {
      "product": "<ObjectId>",      ← soft reference for admin lookup
      "nameSnapshot": "ProBook X1 Laptop",   ← SNAPSHOT at order time
      "priceSnapshot": 1299.00,              ← SNAPSHOT at order time
      "quantity": 2,
      "sku": "PROBOOK-STD"
    }
  ],
  "shippingAddress": {    ← EMBEDDED SNAPSHOT
    "street": "42 Main St",
    "city": "Thimphu"
  }
}
```

**Snapshot justification:** prices and names change. If the order only stored `product._id`, order history would show today's name and price — wrong, legally and practically. `nameSnapshot` and `priceSnapshot` freeze the values at purchase time. The `product` id is kept only for admin deep-linking.

**Embed shippingAddress:** the user's address can change later. The order must keep the address used at checkout.

#### 3.1.4 Review Collection — Why Separate

Reviews live in their own collection, not embedded in `Product`:
- A popular product can have thousands of reviews — embedding would push the document toward MongoDB's 16MB limit.
- Reviews are paginated lazily on the product page, using the `{ product: 1, createdAt: -1 }` index.
- Embedded reviews would lock the whole product document on every edit.

#### 3.1.5 Inventory Collection — Why Separate

Inventory is its own collection too:
- The order transaction checks and decrements stock for several products. Embedding stock in `Product` would make the transaction update the same product document repeatedly, raising lock contention.
- A separate collection lets the transaction lock one `(product, variant)` record with `findOneAndUpdate` and an optimistic `{ quantityAvailable: { $gte: quantity } }` check.
- A warehouse system could manage stock without touching the catalog.

### 3.2 Indexes

| # | Collection | Index | Type | Justification |
|---|-----------|-------|------|---------------|
| 1 | products | `{ name: "text", description: "text", tags: "text" }` | Text (compound) | Full-text search via `$text`. Weights: name=10, tags=5, description=1. |
| 2 | products | `{ category: 1, basePrice: 1 }` | Compound B-tree | Primary browse query — filters by category and sorts by price in one B-tree traversal. |
| 3 | products | `{ seller: 1, createdAt: -1 }` | Compound B-tree | Seller dashboard — fetches a seller's products sorted newest first. |
| 4 | products | `{ isActive: 1, isFeatured: -1, createdAt: -1 }` | Compound B-tree | Homepage featured products query — all three fields satisfied by one index. |
| 5 | orders | `{ user: 1, placedAt: -1 }` | Compound B-tree | Order history — filters by user and sorts by date descending in one IXSCAN. |
| 6 | orders | `{ status: 1, placedAt: -1 }` | Compound B-tree | Aggregation pipeline `$match` stage — avoids full collection scan on delivered orders. |
| 7 | users | `{ email: 1 }` (unique) | Unique B-tree | Login lookup by email. Unique constraint prevents duplicate registrations at DB level. |
| 8 | users | `{ role: 1 }` | B-tree | Filter users by account type for admin queries. |
| 9 | reviews | `{ product: 1, createdAt: -1 }` | Compound B-tree | Paginated reviews per product sorted newest first. |
| 10 | reviews | `{ product: 1, user: 1 }` (unique) | Unique compound | Prevents a user submitting more than one review per product. |
| 11 | inventory | `{ product: 1, variant: 1 }` (unique) | Unique compound | ACID transaction `findOneAndUpdate` lookup — O(log N) and enforces one record per SKU. |
| 12 | categories | `{ slug: 1 }` (unique) | Unique B-tree | Category lookup by URL slug — unique prevents duplicate slugs. |
| 13 | categories | `{ parent: 1 }` | B-tree | Fetch subcategories by parent — used on browse and category management pages. |
| 14 | products | `{ _id: 1 }` (default) | B-tree | Default MongoDB index present on every collection. |

### 3.3 Redis Key Naming Convention

| Key Pattern | Data Type | TTL | Use Case |
|-------------|-----------|-----|----------|
| `session:{userId}` | Hash | 86400s (24h) | User session: userId, email, role, loginAt |
| `cart:{userId}` | Hash | 604800s (7d) | Authenticated cart: field=`{productId}:{sku}`, value=quantity |
| `cart:guest:{guestId}` | Hash | 604800s (7d) | Guest cart before login |
| `product:{productId}` | Hash | ~3600s (jittered) | Cached product JSON (cache-aside) |
| `trending:products` | Sorted Set | No TTL | productId → trending score (views×1 + purchases×5) |
| `recent:{userId}` | List | 604800s (7d) | Recently viewed product IDs (max 10, LPUSH+LTRIM) |
| `ratelimit:{ip}:{endpoint}` | String | 60s window | INCR counter for rate limiting |
| `leaderboard:sellers:{YYYY-MM}` | Sorted Set | 90 days | sellerId → revenue for the month |
| `leaderboard:buyers:{YYYY-MM}` | Sorted Set | 90 days | userId → spend for the month |
| `hll:product:{productId}:views` | HyperLogLog | No TTL | Approximate unique visitor count per product |
| `lock:product:{productId}` | String | 5s | Distributed lock for cache stampede prevention |

---

## 4. Implementation Details

### 4.1 ACID Transaction — Order Placement

The `placeOrder` function in `orderController.js` is the centrepiece of the MongoDB implementation. The transaction flow:

```javascript
const session = await mongoose.startSession();
session.startTransaction({
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority", j: true },
});

// Step 1 & 2: Per item — check stock, then decrement atomically
const inventory = await Inventory.findOne(
  { product: productId, variant: sku },
  null, { session }  // session binds this read to the transaction
);

if (inventory.quantityAvailable < quantity) {
  throw new Error("Insufficient stock");  // triggers abortTransaction
}

await Inventory.findOneAndUpdate(
  { _id: inventory._id, quantityAvailable: { $gte: quantity } },
  { $inc: { quantityAvailable: -quantity } },
  { session }
);

// Step 3: Create order
const [order] = await Order.create([{ ... }], { session });

// Step 4: Commit
await session.commitTransaction();
```

The `{ quantityAvailable: { $gte: quantity } }` condition in `findOneAndUpdate` is an **optimistic concurrency check** — even within a transaction, a concurrent transaction might have decremented stock between the read and write. This condition makes the decrement conditional, preventing overselling.

On any error, `session.abortTransaction()` rolls back ALL inventory decrements atomically. The `finally` block always calls `session.endSession()` to return the session to the pool.

After commit, Redis updates (leaderboard increments, cart clear, trending score) are fired as `Promise.allSettled` — they do not fail the order if Redis is temporarily unavailable.

### 4.2 Cache-Aside Implementation

```
GET /products/:id → HGETALL product:{id}
  HIT  → return cached data
  MISS → SET lock:product:{id} NX EX 5
           got lock → query MongoDB → HSET + EXPIRE (jittered) → DEL lock → return
           no lock  → sleep 100ms → retry HGETALL (another request is loading it)
```

**Jittered TTL:**
```javascript
function jitteredTTL(baseTTL) {
  const jitter = Math.floor(baseTTL * 0.1);
  return baseTTL - jitter + Math.floor(Math.random() * jitter * 2);
}
// For base=3600: returns value in [3240, 3960]
```

Without jitter, all products cached simultaneously (e.g., after a deployment flush) would expire at the same time, causing a thundering herd. With ±10% jitter, expirations are spread over a 720-second window.

**Cache Invalidation:** `PUT /products/:id` and `DELETE /products/:id` both call `invalidateProductCache(id)` which does `DEL product:{id}`. The next request will be a cache miss that fetches the fresh data.

### 4.3 Redis Data Structures in Detail

**Rate Limiting (String + INCR):**
```
POST /auth/login (IP: 192.168.1.100)
  INCR ratelimit:192.168.1.100:_auth_login  → returns count
  if count === 1: EXPIRE ... 60            (first request, start window)
  if count > 5: return 429
```
The `INCR` operation is atomic in Redis — even under thundering herd login attempts, the counter never double-counts.

**Cart (Hash):**
```
HSET cart:user123 "prod456:SKU-BLK" 2    → field=productId:sku, value=quantity
HSET cart:user123 "prod789:SKU-WHT" 1
EXPIRE cart:user123 604800
HGETALL cart:user123  → { "prod456:SKU-BLK": "2", "prod789:SKU-WHT": "1" }
```
Using a Hash field per product/SKU combination means individual items can be updated (HSET), removed (HDEL), or queried (HGET) without affecting other items. A String or List would require deserializing the entire cart.

**Trending (Sorted Set):**
```
ZINCRBY trending:products 1 "prod456"     → product viewed (score += 1)
ZINCRBY trending:products 5 "prod456"     → product purchased (score += 5)
ZREVRANGE trending:products 0 9 WITHSCORES → top 10 with scores
```
Purchases are weighted 5× higher than views because a purchase signals stronger commercial intent than a view. The sorted set maintains sorted order in O(log N) for every increment.

**HyperLogLog:**
```
PFADD hll:product:prod456:views "user123"
PFADD hll:product:prod456:views "192.168.1.50"  (guest by IP)
PFCOUNT hll:product:prod456:views → approximate unique visitors
```
HyperLogLog uses a fixed 12KB regardless of the number of distinct elements. Counting unique visitors with a Set would grow unboundedly.

### 4.4 Aggregation Pipelines

**Monthly Sales Report:**
```javascript
[
  { $match: { status: "delivered", placedAt: { $gte: startDate } } },
  { $group: {
      _id: { year: { $year: "$placedAt" }, month: { $month: "$placedAt" } },
      totalRevenue: { $sum: "$totalAmount" },
      orderCount: { $sum: 1 },
      averageOrderValue: { $avg: "$totalAmount" }
  }},
  { $sort: { "_id.year": 1, "_id.month": 1 } },
  { $project: { period: { $concat: [...] }, totalRevenue: 1, ... } }
]
```
The `{ status: 1, placedAt: -1 }` index on `orders` allows the `$match` stage to use an index scan instead of a collection scan.

**Top-N Products by Revenue:**
```javascript
[
  { $match: { status: "delivered" } },
  { $unwind: "$items" },  // explodes items array
  { $group: {
      _id: "$items.product",
      totalRevenue: { $sum: { $multiply: ["$items.priceSnapshot", "$items.quantity"] } },
      totalQuantitySold: { $sum: "$items.quantity" }
  }},
  { $sort: { totalRevenue: -1 } },
  { $limit: n },
  { $lookup: { from: "products", localField: "_id", ... } }
]
```
`$unwind` is the key stage — it denormalizes the embedded `items` array so each item becomes its own document for grouping.

### 4.5 Eviction Policy: allkeys-lru

ShopNest uses `maxmemory-policy allkeys-lru` configured in `docker/redis.conf`. This policy evicts the least recently used keys across ALL keys when memory reaches the 256MB limit.

**Why allkeys-lru over alternatives:**

**vs volatile-lru:** volatile-lru only evicts keys with TTL set. Some of our keys such as leaderboards and HyperLogLog counters intentionally have no TTL. Using volatile-lru would cause OOM errors when memory fills with non-expiring keys.

**vs noeviction:** noeviction returns errors when memory is full which would crash cart operations and caching during peak traffic. This is unacceptable for production use.

**vs allkeys-random:** Random eviction has no awareness of access patterns. LRU keeps hot data such as frequently viewed products and active sessions in memory longer maximizing cache hit ratio.

**Why allkeys-lru is safe for ShopNest:**
Every Redis key in our system is either reconstructable from MongoDB such as product cache and category cache, or re-creatable by user action such as cart and session on re-login. Evicting any key is therefore safe. The worst case is a cache miss and a MongoDB fallback read not data loss.

---

## 5. Non-Functional Requirements

### NFR1 — Performance
- Redis cache-aside reduces product detail response time from ~150ms (MongoDB) to ~5ms (Redis), a 30× improvement.
- Compound indexes (`category_price_idx`, `user_order_history_idx`) convert COLLSCAN to IXSCAN for the most common queries.
- k6 benchmark scripts (in `/k6/`) measure these improvements under realistic concurrent load.
- MongoDB connection pool (maxPoolSize: 50) prevents exhausting connections under load.

### NFR2 — Scalability
- MongoDB replica set can be converted to a sharded cluster (shard plan in Section 10) without application code changes — only the connection string changes.
- Redis replicas (2) support read scaling for analytics queries.
- Stateless Express backend can be horizontally scaled behind a load balancer — session state is in Redis, not in-process memory.

### NFR3 — High Availability
- **MongoDB:** 3-node replica set with automatic election. If the primary fails, an election completes in seconds. The connection string includes all 3 nodes so the driver can discover the new primary.
- **Redis:** Sentinel HA with 3 sentinels (quorum=2). If the master fails, sentinels vote on a failover candidate and promote a replica. ioredis Sentinel client reconnects to the new master automatically.

### NFR4 — Consistency
- Write concern `{ w: "majority", j: true }` on order placement and inventory updates ensures writes are acknowledged by a quorum of replica set members AND journaled before returning. This protects against data loss if the primary crashes mid-write.
- Read concern `"snapshot"` is used inside ACID transactions — every read within the transaction sees the database as it was at transaction start, preventing dirty reads from concurrent writes.
- Read concern `"majority"` on standalone critical reads outside transactions (orders, inventory checks) ensures we never read uncommitted data from a secondary that hasn't caught up.
- Write concern `{ w: 1 }` is used for non-critical writes (view count increments, analytics events) to prioritise throughput.

### NFR5 — Durability
- MongoDB: WiredTiger journaling ensures crash recovery. Write concern `j:true` waits for journal flush before acknowledging a write.
- Redis: Hybrid persistence (RDB + AOF). RDB snapshots provide fast restart. AOF with `appendfsync everysec` limits data loss to at most 1 second of writes.

### NFR6 — Security
- Passwords hashed with bcrypt (saltRounds: 12) — computationally expensive enough to resist offline dictionary attacks. Passwords are never stored in plaintext and are excluded from query results via `select: false`.
- JWT tokens validated against active Redis sessions — logout invalidates the session immediately, even if the JWT is not expired.
- Role-based access control (`authorize("admin", "seller")` middleware) protects privileged routes.
- Rate limiting on `/auth/login` (5 req/60s/IP) prevents brute-force attacks.
- MongoDB keyfile authentication between replica set members.
- `helmet` middleware sets security HTTP headers.

### NFR7 — Observability
- `GET /health` endpoint checks both MongoDB and Redis connectivity.
- `GET /analytics/cache-stats` exposes Redis INFO stats (hit ratio, memory, connected clients).
- Morgan logging middleware records every request with method, path, status, and response time.
- Console logging for MongoDB reconnect events and Redis failover events.

### NFR8 — Data Integrity
- **ACID transactions for order placement:** `orderController.placeOrder()` runs a multi-document MongoDB transaction (`session.startTransaction` with `readConcern: snapshot`, `writeConcern: { w: "majority", j: true }`). Inventory decrements and order creation either all commit together or all roll back via `abortTransaction()` — no partial orders or oversold stock are possible.
- **Atomic stock guard:** the decrement uses `findOneAndUpdate({ _id, quantityAvailable: { $gte: quantity } }, { $inc: { quantityAvailable: -quantity } })`, so two concurrent orders for the last item cannot both succeed.
- **Schema validation:** Mongoose enforces required fields, enums (order status, payment method), and `min/max` constraints at the database boundary, rejecting malformed documents.
- **Price/name snapshots:** order items store `priceSnapshot` and `nameSnapshot` at purchase time, so later product edits cannot alter historical order records.
- **Unique constraints:** `email` (users), `product+variant` (inventory), and `product+user` (reviews) unique indexes prevent duplicate/inconsistent records.

---

## 6. Performance Analysis

> **Measured data** — all results below are from actual benchmark runs against the live Docker environment (2026-06-01). See `benchmark-results.md` for the full raw output.

### 6.1 MongoDB Query Performance — Measured Results

The following results were captured with `explain("executionStats")` on the live replica set (PRIMARY: mongo1, MongoDB 7.0.34, dataset: 50 products / 20 orders).

**Query 1: Category filter — uses `category_price_idx`**
```
db.products.find(
  { category: ObjectId("6a1dbcb4c5dd314f1690129e"), isActive: true },
  { name: 1, basePrice: 1, isFeatured: 1 }
).explain("executionStats")

executionTimeMillis:  0 ms
totalKeysExamined:   15     ← index entries scanned
totalDocsExamined:   15     ← documents fetched
totalDocsReturned:   15
stage pipeline:       IXSCAN(category_price_idx) → FETCH → PROJECTION_SIMPLE
```
The `{ category: 1, basePrice: 1 }` compound index satisfies the category equality predicate via a prefix scan. Only the 15 matching Electronics documents are read — zero wasted I/O. The `isActive` post-filter runs on the 15 fetched documents because `isActive` is not the leading index field; at the current data volume this is negligible.

**Query 2: Price-only filter — no covering index (COLLSCAN)**
```
db.products.find({ isActive: true, basePrice: { $lte: 500 } })
  .explain("executionStats")

executionTimeMillis:  0 ms
totalDocsExamined:   50     ← full collection scan
totalDocsReturned:   41
stage pipeline:       COLLSCAN → FETCH
```
No existing index has `basePrice` as a leading field — the compound `{ category: 1, basePrice: 1 }` cannot be used for a price-only query (the leading `category` field is unbound). At 50 documents this is acceptable; at scale a dedicated `{ isActive: 1, basePrice: 1 }` index would reduce examination from N to the matching subset. This is addressed in the Sharding Plan (Section 9).

**Query 3: Order history — `user_order_history_idx` with free sort**
```
db.orders.find({ user: <userId> }).sort({ placedAt: -1 })
  .explain("executionStats")

executionTimeMillis:  0 ms
totalDocsExamined:    3     ← only this customer's orders
totalDocsReturned:    3
stage pipeline:       IXSCAN(user_order_history_idx) → FETCH
                      (no in-memory SORT stage — index is pre-sorted)
```
The `{ user: 1, placedAt: -1 }` compound index satisfies both the equality filter **and** the descending sort in a single forward IXSCAN. MongoDB avoids a separate in-memory SORT stage, which at large order volumes would otherwise allocate a sort buffer and cap at 32 MB.

**Full-text Search:**
```
db.products.find({ $text: { $search: "laptop ultrabook" } })
  Without text index: ERROR — $text requires a text index
  With product_text_idx: executionTimeMillis: 8ms, stage: TEXT
```

(The full index list with justifications is in Section 3.2. There are 14 indexes overall: 8 compound, 1 text, and 5 single-field.)

### 6.2 Redis Cache Benchmark — Measured Results

The `k6/benchmark-cache.js` script was run against the live system with Redis flushed immediately before the cold phase.

**Setup:**
```bash
docker exec shopnest-redis-master redis-cli FLUSHALL
docker run --rm -i --network shopnest_shopnest-net \
  grafana/k6 run --env BASE_URL=http://backend:5000 \
  - < backend/k6/benchmark-cache.js
```

**Scenarios executed:**
- `cold_cache`: 20 VUs × 50 iterations — unique product IDs rotate across all 50 products, each generating one cache miss that primes the Redis cache
- `hot_cache`: 50 VUs × 2 minutes — only 10 products rotated, maximising hit rate

**Measured results:**
```
╔══════════════════════════════════════╗
║     ShopNest Cache Benchmark         ║
╠══════════════════════════════════════╣
║  Cache Hit Rate:      99.9%          ║
║  Total Requests:     57,010          ║
║  Cache Hits:         56,960          ║
║  Cache Misses:           50          ║
╠══════════════════════════════════════╣
║  HIT  p95:   12 ms   ← Redis         ║
║  MISS p95:   65 ms   ← MongoDB       ║
╚══════════════════════════════════════╝

Speedup at p95:  5.4×  (65 ms → 12 ms)
Total throughput: ~211 req/s  (50 VUs sustained)
```

**k6 threshold results (all passed ✓):**

| Threshold | Target | Measured | Result |
|-----------|--------|----------|--------|
| `cache_hit_latency_ms p(95)` | < 15 ms | **12 ms** | ✓ |
| `cache_miss_latency_ms p(95)` | < 300 ms | **65 ms** | ✓ |
| `http_req_failed rate` | < 1% | **0%** | ✓ |

**Why 99.9% hit rate and only 50 misses?**
The cold phase runs 1,000 iterations (20 VUs × 50 each) cycling through `productIds[(__VU * __ITER) % 50]`. With exactly 50 unique products, each product generates exactly one cache miss on its first request, then enters the Redis cache. All 56,960 subsequent requests in the hot phase find their product already cached. This demonstrates that the cache-aside pattern with SET NX EX priming (implemented in `middleware/cacheMiddleware.js`) works correctly under concurrent load.

**Why MISS p95 is 65 ms (not 150–300 ms as originally predicted):**
The test environment runs all services on a single Mac M4 host with no actual network hops. Localhost Docker networking has sub-millisecond latency versus the multi-datacenter latency used in the original prediction. The 5.4× speedup ratio is consistent with production expectations; the absolute values scale with real network topology.

The `X-Cache` response header (`HIT` / `MISS` / `HIT-COALESCED`) allows the benchmark to distinguish hits from misses in `res.headers["X-Cache"]`, and is also visible in the frontend product detail page as the green **CACHED** / gray **LIVE** badge.

---

## 7. CAP Theorem Discussion

### 7.1 MongoDB — CP System

MongoDB is a **CP** system (Consistency + Partition-tolerance). During a partition, a new primary is elected only if a majority of nodes agree. If no majority exists, there's no primary and writes fail. This gives up availability to keep data consistent — better to refuse a write than accept conflicting ones on both sides.

**Write concerns:**
- `{ w: "majority", j: true }` on orders and inventory — with only `w: 1`, a write acknowledged by the primary could be lost if it crashes before replicating. Majority ensures 2/3 nodes have it first.
- `{ w: 1 }` on view-count increments — these are approximate, so a rare lost increment doesn't matter, and `w: 1` is faster.

**Read concerns:**
- `"majority"` on order/inventory reads — never read data not yet committed to a majority, which would risk overselling from a lagging secondary.
- Default on product listings — the catalog is read-heavy and a brief lag showing a new product is fine.

### 7.2 Redis Sentinel — AP with Eventual Consistency

Redis is an **AP** system (Availability + Partition-tolerance). Master→replica replication is asynchronous: the client is acknowledged as soon as the master applies a write, and replicas catch up shortly after. During failover (~5s) a freshly promoted replica may miss the old master's last writes.

That eventual consistency is fine for what Redis stores here — sessions, carts, leaderboards. A cart item briefly flickering during a failover is better than downtime. Anything that must be exact (orders, inventory) lives in MongoDB instead.

---

## 8. Challenges Faced and Resolutions

### Challenge 1: Replica Set Initialization Timing

**Problem:** The backend started before the replica set finished electing a primary. `mongoose.connect()` needs a reachable primary, but `rs.initiate()` and the election took ~15 seconds, so the backend failed to connect on first boot.

**Fix:** `mongo-init` waits on all three nodes' health checks, sleeps 5s, runs `rs.initiate()`, then polls until a member reports `stateStr === "PRIMARY"`. The backend `depends_on` `mongo-init` exiting cleanly, and `serverSelectionTimeoutMS: 10000` gives the driver 10s to find the primary.

### Challenge 2: Cache Stampede Under High Concurrency

**Problem:** With 50 concurrent users, when a popular product's cache expired, all 50 requests missed at once and hit MongoDB together — a latency spike.

**Fix:** A distributed lock with `SET lock:product:{id} "1" NX EX 5`. The first miss acquires the lock, loads from MongoDB, caches it, and releases. The others wait 100ms and retry the cache (request coalescing). If Redis is down, the lock just fails and requests fall through to MongoDB — no crash. Jittered TTLs also stop many keys expiring at the same instant.

### Challenge 3: Concurrent Orders for the Last Item

**Problem:** Two users ordering the same last-in-stock item both tried to `findOneAndUpdate` the same `Inventory` document, causing one transaction to wait and risk a timeout.

**Fix:** An optimistic check on the decrement: `findOneAndUpdate({ _id, quantityAvailable: { $gte: quantity } })`. If stock would go negative the update matches nothing, the transaction throws "Insufficient stock", and `abortTransaction()` rolls back and releases locks. Socket/selection timeouts abort hung transactions, and the 3-per-60s checkout rate limit reduces concurrent writes per user.

---

## 9. Future Enhancements

### 9.1 Elasticsearch for Full-Text Search
MongoDB's `$text` index works but has no relevance tuning, faceted search, or typo tolerance. Elasticsearch would add fuzzy matching and faceted filtering, kept in sync via MongoDB Change Streams.

### 9.2 Apache Kafka for Event Streaming
Post-order Redis updates are fire-and-forget and can fail silently. Publishing an `order.placed` event to Kafka would let separate consumers handle leaderboards, emails, and stock alerts — with durability and replay.

### 9.3 GraphQL API
A product page now needs several REST calls (product + reviews + inventory + related). GraphQL would fetch exactly what's needed in one request. Apollo Server works with Mongoose and uses DataLoader to avoid N+1 queries.

### 9.4 Redis Streams for Real-time Notifications
Redis Streams (`XADD`/`XREADGROUP`) are a persistent queue with consumer groups. They could push shipping updates, seller low-stock alerts, and live trending changes to the frontend. Unlike Pub/Sub, Streams persist messages and give at-least-once delivery.

---

## 10. Sharding Plan (Theoretical)

| Collection | Shard Key | Strategy | Justification |
|-----------|----------|----------|---------------|
| `users` | `{ _id: "hashed" }` | Hash-based | Even distribution across shards. User documents are accessed by `_id` — hashed sharding ensures no hot spots. |
| `products` | `{ category: 1, _id: 1 }` | Range-based | Collocates products within the same category on the same shard, improving category browse queries. The compound key with `_id` prevents hotspots when a single category dominates. |
| `orders` | `{ user: 1, placedAt: 1 }` | Range-based | Keeps all of a user's orders on the same shard, making order history queries single-shard (no scatter-gather). The `placedAt` component spreads recent orders across the date range. |
| `inventory` | `{ product: 1, variant: 1 }` | Range-based | Co-locates inventory with product queries. ACID transactions involving inventory records for the same product will target the same shard. |
| `reviews` | `{ product: 1, createdAt: -1 }` | Range-based | Co-locates reviews per product. Paginated review queries are single-shard. |

---

## 11. References

[1] Bradshaw, S., Brazil, E., and Chodorow, K. (2019). *MongoDB: The Definitive Guide*, 3rd ed. O'Reilly Media. ISBN 978-1-491-95446-1.

[2] Carlson, J. L. (2013). *Redis in Action*. Manning Publications. ISBN 978-1-617-29009-9.

[3] MongoDB, Inc. (2024). *MongoDB Documentation: Replica Sets*. Available at: https://www.mongodb.com/docs/manual/replication/ [Accessed June 2026].

[4] MongoDB, Inc. (2024). *MongoDB Documentation: Transactions*. Available at: https://www.mongodb.com/docs/manual/core/transactions/ [Accessed June 2026].

[5] Redis Ltd. (2024). *Redis Documentation: Data Structures*. Available at: https://redis.io/docs/data-types/ [Accessed June 2026].

[6] Redis Ltd. (2024). *Redis Documentation: Sentinel High Availability*. Available at: https://redis.io/docs/management/sentinel/ [Accessed June 2026].

[7] Brewer, E. (2012). CAP twelve years later: How the "rules" have changed. *IEEE Computer*, 45(2), pp. 23–29.

[8] Fowler, M. and Sadalage, P. J. (2012). *NoSQL Distilled: A Brief Guide to the Emerging World of Polyglot Persistence*. Addison-Wesley. ISBN 978-0-321-82662-6.
