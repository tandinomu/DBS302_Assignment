/**
 * Cache Benchmark — Before/After Comparison
 *
 * Run WITHOUT cache (flush Redis first):
 *   redis-cli FLUSHALL && k6 run --env CACHE_ENABLED=false benchmark-cache.js
 *
 * Run WITH cache (warm it up first):
 *   k6 run --env CACHE_ENABLED=true benchmark-cache.js
 *
 * Compare the p50/p95/p99 latency distributions.
 * Expected: cache miss ~80–200ms (MongoDB), cache hit ~2–10ms (Redis)
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";

const cacheHitLatency  = new Trend("cache_hit_latency_ms",  true);
const cacheMissLatency = new Trend("cache_miss_latency_ms", true);
const cacheHitCount    = new Counter("cache_hits");
const cacheMissCount   = new Counter("cache_misses");

export const options = {
  scenarios: {
    // Phase 1: Cold cache — sequential unique product IDs force DB hits
    cold_cache: {
      executor: "per-vu-iterations",
      vus: 20,
      iterations: 50,
      maxDuration: "2m",
      env: { SCENARIO: "cold" },
    },
    // Phase 2: Hot cache — same 10 products requested repeatedly
    hot_cache: {
      executor: "constant-vus",
      vus: 50,
      duration: "2m",
      startTime: "2m30s", // start after cold phase finishes
      env: { SCENARIO: "hot" },
    },
  },
  thresholds: {
    cache_hit_latency_ms:  ["p(95)<15"],    // Redis should respond <15ms at p95
    cache_miss_latency_ms: ["p(95)<300"],   // MongoDB should respond <300ms at p95
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

// Fetch product IDs in setup
export function setup() {
  const res = http.get(`${BASE_URL}/products?limit=100`);
  if (res.status !== 200) return { productIds: [] };
  return { productIds: JSON.parse(res.body).data.map((p) => p._id) };
}

export default function (data) {
  const { productIds } = data;
  if (productIds.length === 0) return;

  const scenario = __ENV.SCENARIO;

  let productId;
  if (scenario === "cold") {
    // Unique product per iteration = guaranteed cache miss (if Redis is empty)
    productId = productIds[(__VU * __ITER) % productIds.length];
  } else {
    // Only 10 products = high cache hit rate after first round
    productId = productIds[Math.floor(Math.random() * Math.min(10, productIds.length))];
  }

  const start = Date.now();
  const res = http.get(`${BASE_URL}/products/${productId}`);
  const latency = Date.now() - start;

  const xCache = res.headers["X-Cache"] || "";
  const isHit = xCache.includes("HIT");

  if (isHit) {
    cacheHitLatency.add(latency);
    cacheHitCount.add(1);
  } else {
    cacheMissLatency.add(latency);
    cacheMissCount.add(1);
  }

  check(res, {
    "status 200":   (r) => r.status === 200,
    "has product":  (r) => !!JSON.parse(r.body).data?.name,
    "X-Cache set":  (r) => !!r.headers["X-Cache"],
  });

  sleep(0.1);
}

export function handleSummary(data) {
  const hitP50  = data.metrics.cache_hit_latency_ms?.values?.["p(50)"]?.toFixed(2) || "N/A";
  const hitP95  = data.metrics.cache_hit_latency_ms?.values?.["p(95)"]?.toFixed(2) || "N/A";
  const missP50 = data.metrics.cache_miss_latency_ms?.values?.["p(50)"]?.toFixed(2) || "N/A";
  const missP95 = data.metrics.cache_miss_latency_ms?.values?.["p(95)"]?.toFixed(2) || "N/A";
  const hitCnt  = data.metrics.cache_hits?.values?.count || 0;
  const missCnt = data.metrics.cache_misses?.values?.count || 0;
  const total   = hitCnt + missCnt;
  const hitRate = total > 0 ? ((hitCnt / total) * 100).toFixed(1) : "0.0";

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     ShopNest Cache Benchmark         ║");
  console.log("╠══════════════════════════════════════╣");
  console.log(`║  Cache Hit Rate:    ${hitRate.padStart(6)}%           ║`);
  console.log(`║  Total Requests:    ${String(total).padStart(6)}              ║`);
  console.log(`║  Cache Hits:        ${String(hitCnt).padStart(6)}              ║`);
  console.log(`║  Cache Misses:      ${String(missCnt).padStart(6)}              ║`);
  console.log("╠══════════════════════════════════════╣");
  console.log(`║  HIT  p50: ${hitP50.padStart(7)} ms                 ║`);
  console.log(`║  HIT  p95: ${hitP95.padStart(7)} ms                 ║`);
  console.log(`║  MISS p50: ${missP50.padStart(7)} ms                 ║`);
  console.log(`║  MISS p95: ${missP95.padStart(7)} ms                 ║`);
  console.log("╚══════════════════════════════════════╝\n");

  return { stdout: "" };
}
