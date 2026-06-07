import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ─── Custom Metrics ───────────────────────────────────────────────────────────
const errorRate = new Rate("errors");
const productListLatency = new Trend("product_list_latency");
const productDetailLatency = new Trend("product_detail_latency");
const loginLatency = new Trend("login_latency");
const checkoutLatency = new Trend("checkout_latency");
const totalRequests = new Counter("total_requests");

// ─── Test Configuration ───────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: "30s", target: 10 },   // Ramp up to 10 VUs
    { duration: "1m",  target: 50 },   // Ramp up to 50 VUs
    { duration: "2m",  target: 50 },   // Hold at 50 VUs
    { duration: "30s", target: 100 },  // Spike to 100 VUs
    { duration: "1m",  target: 100 },  // Hold at 100
    { duration: "30s", target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    errors: ["rate<0.05"],             // < 5% error rate
    product_detail_latency: ["p(95)<300"],
    product_list_latency:   ["p(95)<400"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

let authToken = null;
let productIds = [];

// ─── Setup: Fetch a token and some product IDs ────────────────────────────────
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: "carol@shopnest.com", password: "Password123!" }),
    { headers: { "Content-Type": "application/json" } }
  );

  let token = null;
  if (loginRes.status === 200) {
    token = JSON.parse(loginRes.body).token;
  }

  const productsRes = http.get(`${BASE_URL}/products?limit=20`);
  let ids = [];
  if (productsRes.status === 200) {
    ids = JSON.parse(productsRes.body).data.map((p) => p._id);
  }

  return { token, productIds: ids };
}

// ─── Main Test Function ───────────────────────────────────────────────────────
export default function (data) {
  const headers = {
    "Content-Type": "application/json",
    ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
  };

  // Scenario weights: product browsing is most common
  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% — Browse product list
    group("product_list", () => {
      const page = Math.floor(Math.random() * 5) + 1;
      const start = Date.now();
      const res = http.get(`${BASE_URL}/products?page=${page}&limit=20`, { headers });
      productListLatency.add(Date.now() - start);
      totalRequests.add(1);
      const ok = check(res, {
        "product list 200": (r) => r.status === 200,
        "has data array":   (r) => JSON.parse(r.body).data !== undefined,
      });
      errorRate.add(!ok);
    });
  } else if (scenario < 0.7) {
    // 30% — View product detail (exercises Redis cache)
    group("product_detail", () => {
      if (data.productIds.length === 0) return;
      const id = data.productIds[Math.floor(Math.random() * data.productIds.length)];
      const start = Date.now();
      const res = http.get(`${BASE_URL}/products/${id}`, { headers });
      productDetailLatency.add(Date.now() - start);
      totalRequests.add(1);
      const ok = check(res, {
        "product detail 200": (r) => r.status === 200,
        "has product name":   (r) => JSON.parse(r.body).data?.name !== undefined,
      });
      errorRate.add(!ok);
    });
  } else if (scenario < 0.85) {
    // 15% — Search
    group("search", () => {
      const queries = ["laptop", "headphones", "book", "shirt", "yoga"];
      const q = queries[Math.floor(Math.random() * queries.length)];
      const res = http.get(`${BASE_URL}/products/search?q=${q}`, { headers });
      totalRequests.add(1);
      check(res, { "search 200": (r) => r.status === 200 });
    });
  } else if (scenario < 0.95) {
    // 10% — Trending analytics (public endpoint)
    group("trending", () => {
      const res = http.get(`${BASE_URL}/analytics/trending?limit=10`, { headers });
      totalRequests.add(1);
      check(res, { "trending 200": (r) => r.status === 200 });
    });
  } else {
    // 5% — Cart add
    group("cart", () => {
      if (!data.token || data.productIds.length === 0) return;
      const res = http.get(`${BASE_URL}/cart`, { headers });
      totalRequests.add(1);
      check(res, { "cart 200": (r) => r.status === 200 });
    });
  }

  sleep(Math.random() * 2 + 0.5); // Think time: 0.5–2.5s
}

export function teardown(data) {
  console.log(`Load test complete. Total requests: ${totalRequests}`);
}
