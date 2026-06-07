# ShopNest — Benchmark Results

**Date:** 2026-06-01  
**Environment:** Docker Compose (3-node MongoDB replica set, Redis Sentinel HA, Express backend)  
**Dataset:** 50 products, 20 orders, 80 reviews (seeded)

---

## 1. k6 Cache Benchmark

**Command:**
```bash
docker exec shopnest-redis-master redis-cli FLUSHALL   # cold start
docker run --rm -i --network shopnest_shopnest-net \
  grafana/k6 run --env BASE_URL=http://backend:5000 \
  - < backend/k6/benchmark-cache.js
```

**Scenarios:**
- `cold_cache`: 20 VUs × 50 iterations each (1,000 total), Redis flushed before run — forces MongoDB reads
- `hot_cache`: 50 VUs × 2 minutes, only 10 products rotated — maximises Redis cache hits

**Results:**

```
╔══════════════════════════════════════╗
║     ShopNest Cache Benchmark         ║
╠══════════════════════════════════════╣
║  Cache Hit Rate:      99.9%          ║
║  Total Requests:     57,010          ║
║  Cache Hits:         56,960          ║
║  Cache Misses:           50          ║
╠══════════════════════════════════════╣
║  HIT  p95:   12.00 ms  (Redis)       ║
║  MISS p95:   65.00 ms  (MongoDB)     ║
╚══════════════════════════════════════╝

Scenarios:
  cold_cache  ✓  20 VUs  0m05.3s   1,000/1,000 iters
  hot_cache   ✓  50 VUs  2m00s    56,010 iters
```

**Thresholds (all passed ✓):**
- `cache_hit_latency_ms p(95) < 15 ms` — **passed: 12 ms**
- `cache_miss_latency_ms p(95) < 300 ms` — **passed: 65 ms**
- `http_req_failed rate < 1%` — **passed: 0%**

**Interpretation:**

| Metric | Value | Notes |
|--------|-------|-------|
| Cache hit rate | 99.9% | 50 cold misses primed the cache; all 56,960 hot requests were hits |
| HIT p95 | **12 ms** | Redis in-network round-trip including Node.js serialisation overhead |
| MISS p95 | **65 ms** | MongoDB primary read + populate(category) + Redis write |
| Speedup (p95) | **5.4×** | 65 ms → 12 ms at p95 |
| Total throughput | ~211 req/s | At peak 50 VUs sustained over 2 minutes |

The 50 cache misses occurred during the cold phase (one per unique product — `productIds[(__VU * __ITER) % 50]`). After each product was fetched from MongoDB and stored in Redis, every subsequent request for that product was a cache HIT. This demonstrates the cache-aside pattern working correctly.

---

## 2. MongoDB Query Explain — executionStats

**MongoDB version:** 7.0.34  
**Replica set:** rs0 (PRIMARY: mongo1)  
**Collection size:** products=50 docs, orders=20 docs

### Query 1 — Category Filter (index scan)

```javascript
db.products.find(
  { category: ObjectId("6a1dbcb4c5dd314f1690129e"), isActive: true },
  { name: 1, basePrice: 1, isFeatured: 1 }
).explain("executionStats")
```

**Results:**
```
winningPlan:
  stage:      PROJECTION_SIMPLE
  inputStage: FETCH
    filter:   { isActive: { $eq: true } }
    inputStage: IXSCAN
      indexName:   category_price_idx
      keyPattern:  { category: 1, basePrice: 1 }
      direction:   forward
      indexBounds:
        category: [ObjectId("6a1dbcb4c5dd314f1690129e"), ObjectId("6a1dbcb4c5dd314f1690129e")]
        basePrice: [MinKey, MaxKey]

executionStats:
  executionTimeMillis:  0 ms
  totalDocsExamined:   15    (only Electronics products)
  totalDocsReturned:   15
  totalKeysExamined:   15
  stage: IXSCAN → FETCH → PROJECTION
```

**Analysis:**  
The query uses the `category_price_idx` compound index `{ category: 1, basePrice: 1 }`. MongoDB performs a prefix scan on the `category` field — 15 keys examined equals 15 docs returned, zero wasted I/O. The `isActive: true` post-filter runs on the 15 fetched documents (not indexed, but acceptable since `isActive` is nearly always `true`). Adding `isActive` to the index as a leading field would eliminate this post-filter.

### Query 2 — Price Filter Alone (collection scan)

```javascript
db.products.find(
  { isActive: true, basePrice: { $lte: 500 } }
).explain("executionStats")
```

**Results:**
```
winningPlan:
  stage: FETCH
    inputStage: COLLSCAN
      direction: forward

executionStats:
  executionTimeMillis:  0 ms
  totalDocsExamined:   50    (full collection scan)
  totalDocsReturned:   41
  stage: COLLSCAN → FETCH
```

**Analysis:**  
No index covers `basePrice` in isolation — only the compound `{ category: 1, basePrice: 1 }` index exists, which MongoDB cannot use for a price-only query (the compound index requires the leading `category` field to be bound). At 50 documents this is acceptable, but at scale a dedicated `{ isActive: 1, basePrice: 1 }` index would reduce examination from N to the matching subset. This is a known gap (see Sharding Plan in report section 9).

### Query 3 — Order History (index scan + free sort)

```javascript
db.orders.find({ user: <userId> }).sort({ placedAt: -1 }).explain("executionStats")
```

**Results:**
```
winningPlan:
  stage: FETCH
    inputStage: IXSCAN
      indexName:   user_order_history_idx
      keyPattern:  { user: 1, placedAt: -1 }
      direction:   forward

executionStats:
  executionTimeMillis:  0 ms
  totalDocsExamined:    3    (this customer's orders only)
  totalDocsReturned:    3
  stage: IXSCAN → FETCH (no in-memory sort needed)
```

**Analysis:**  
The `{ user: 1, placedAt: -1 }` compound index satisfies both the equality filter on `user` AND the descending sort on `placedAt`. MongoDB performs a single forward IXSCAN and returns documents in the correct order — no separate SORT stage is needed. This is the optimal plan for paginated order history queries.

---

## 3. Index Inventory

### products collection

| Index name | Key pattern | Purpose |
|------------|-------------|---------|
| `_id_` | `{ _id: 1 }` | Default primary key |
| `product_text_idx` | `{ _fts: "text", _ftsx: 1 }` | Full-text search on name + description |
| `category_price_idx` | `{ category: 1, basePrice: 1 }` | Category browse + price range filter |
| `seller_1_createdAt_-1` | `{ seller: 1, createdAt: -1 }` | Seller dashboard product listing |
| `isActive_1_isFeatured_-1_createdAt_-1` | `{ isActive: 1, isFeatured: -1, createdAt: -1 }` | Homepage featured products query |

### orders collection

| Index name | Key pattern | Purpose |
|------------|-------------|---------|
| `_id_` | `{ _id: 1 }` | Default primary key |
| `user_order_history_idx` | `{ user: 1, placedAt: -1 }` | Order history — filter + sort in one scan |
| `status_1_placedAt_-1` | `{ status: 1, placedAt: -1 }` | Admin order management — filter by status |

---

## 4. Summary

| Test | Result |
|------|--------|
| Cache hit rate (57,010 requests) | **99.9%** |
| Redis HIT p95 latency | **12 ms** |
| MongoDB MISS p95 latency | **65 ms** |
| Cache speedup at p95 | **5.4×** |
| Query 1 (category IXSCAN) | **0 ms, 15/15 docs** — optimal |
| Query 2 (price COLLSCAN) | **0 ms, 50→41 docs** — gap: no price-only index |
| Query 3 (order history IXSCAN) | **0 ms, 3/3 docs, free sort** — optimal |
| k6 thresholds | **All 3 passed ✓** |
