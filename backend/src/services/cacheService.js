const { getRedisClient } = require("../config/redis");

// Jittered TTL: base ± 10% prevents thundering herd when many keys expire simultaneously
function jitteredTTL(baseTTL) {
  const jitter = Math.floor(baseTTL * 0.1);
  return baseTTL - jitter + Math.floor(Math.random() * jitter * 2);
}

const BASE_TTL = parseInt(process.env.CACHE_TTL || "3600", 10);

// ─── Product Cache (Hash) ────────────────────────────────────────────────────

async function getCachedProduct(productId) {
  const redis = getRedisClient();
  try {
    const data = await redis.hgetall(`product:${productId}`);
    if (!data || Object.keys(data).length === 0) return null;
    // Deserialize: Redis stores everything as strings
    return JSON.parse(data.json);
  } catch (err) {
    console.error("[Cache] getCachedProduct error:", err.message);
    return null;
  }
}

async function setCachedProduct(productId, productData) {
  const redis = getRedisClient();
  try {
    const ttl = jitteredTTL(BASE_TTL);
    const key = `product:${productId}`;
    await redis.hset(key, "json", JSON.stringify(productData), "cachedAt", Date.now());
    await redis.expire(key, ttl);
  } catch (err) {
    console.error("[Cache] setCachedProduct error:", err.message);
  }
}

async function invalidateProductCache(productId) {
  const redis = getRedisClient();
  try {
    await redis.del(`product:${productId}`);
  } catch (err) {
    console.error("[Cache] invalidateProductCache error:", err.message);
  }
}

// ─── Distributed Lock (cache stampede prevention) ────────────────────────────

async function acquireLock(key, ttlSeconds = 5) {
  const redis = getRedisClient();
  try {
    // SET NX EX — atomic: only set if key does not exist
    const result = await redis.set(`lock:${key}`, "1", "NX", "EX", ttlSeconds);
    return result === "OK";
  } catch (err) {
    console.error("[Cache] acquireLock error:", err.message);
    return false;
  }
}

async function releaseLock(key) {
  const redis = getRedisClient();
  try {
    await redis.del(`lock:${key}`);
  } catch (err) {
    console.error("[Cache] releaseLock error:", err.message);
  }
}

// ─── Session (Hash) ──────────────────────────────────────────────────────────

async function setSession(userId, sessionData) {
  const redis = getRedisClient();
  try {
    const key = `session:${userId}`;
    await redis.hset(key, {
      userId: String(sessionData.userId),
      email: sessionData.email,
      role: sessionData.role,
      loginAt: String(sessionData.loginAt || Date.now()),
    });
    await redis.expire(key, 86400); // 24 hours
  } catch (err) {
    console.error("[Cache] setSession error:", err.message);
  }
}

async function getSession(userId) {
  const redis = getRedisClient();
  try {
    const data = await redis.hgetall(`session:${userId}`);
    if (!data || Object.keys(data).length === 0) return null;
    return data;
  } catch (err) {
    console.error("[Cache] getSession error:", err.message);
    return null;
  }
}

async function deleteSession(userId) {
  const redis = getRedisClient();
  try {
    await redis.del(`session:${userId}`);
  } catch (err) {
    console.error("[Cache] deleteSession error:", err.message);
  }
}

// ─── Cart (Hash) ─────────────────────────────────────────────────────────────

function cartKey(userId, isGuest = false) {
  return isGuest ? `cart:guest:${userId}` : `cart:${userId}`;
}

async function getCart(userId, isGuest = false) {
  const redis = getRedisClient();
  try {
    return await redis.hgetall(cartKey(userId, isGuest)) || {};
  } catch (err) {
    console.error("[Cache] getCart error:", err.message);
    return {};
  }
}

async function setCartItem(userId, productId, sku, quantity, isGuest = false) {
  const redis = getRedisClient();
  try {
    const key = cartKey(userId, isGuest);
    const field = `${productId}:${sku}`;
    if (quantity <= 0) {
      await redis.hdel(key, field);
    } else {
      await redis.hset(key, field, String(quantity));
    }
    await redis.expire(key, 604800); // 7 days
  } catch (err) {
    console.error("[Cache] setCartItem error:", err.message);
  }
}

async function removeCartItem(userId, productId, sku, isGuest = false) {
  const redis = getRedisClient();
  try {
    await redis.hdel(cartKey(userId, isGuest), `${productId}:${sku}`);
  } catch (err) {
    console.error("[Cache] removeCartItem error:", err.message);
  }
}

async function clearCart(userId, isGuest = false) {
  const redis = getRedisClient();
  try {
    await redis.del(cartKey(userId, isGuest));
  } catch (err) {
    console.error("[Cache] clearCart error:", err.message);
  }
}

// Merge guest cart into user cart on login
async function mergeGuestCart(guestId, userId) {
  const redis = getRedisClient();
  try {
    const guestCart = await redis.hgetall(`cart:guest:${guestId}`);
    if (!guestCart || Object.keys(guestCart).length === 0) return;
    const userKey = `cart:${userId}`;
    const pipeline = redis.pipeline();
    for (const [field, qty] of Object.entries(guestCart)) {
      const existing = await redis.hget(userKey, field);
      const newQty = (parseInt(existing || "0", 10) + parseInt(qty, 10)).toString();
      pipeline.hset(userKey, field, newQty);
    }
    pipeline.expire(userKey, 604800);
    pipeline.del(`cart:guest:${guestId}`);
    await pipeline.exec();
  } catch (err) {
    console.error("[Cache] mergeGuestCart error:", err.message);
  }
}

// ─── Recently Viewed (List) ───────────────────────────────────────────────────

async function addRecentlyViewed(userId, productId) {
  const redis = getRedisClient();
  try {
    const key = `recent:${userId}`;
    await redis.lpush(key, String(productId));
    await redis.ltrim(key, 0, 9); // keep last 10
    await redis.expire(key, 604800);
  } catch (err) {
    console.error("[Cache] addRecentlyViewed error:", err.message);
  }
}

async function getRecentlyViewed(userId) {
  const redis = getRedisClient();
  try {
    return await redis.lrange(`recent:${userId}`, 0, 9);
  } catch (err) {
    console.error("[Cache] getRecentlyViewed error:", err.message);
    return [];
  }
}

// ─── Trending Products (Sorted Set) ──────────────────────────────────────────

async function incrementTrendingView(productId) {
  const redis = getRedisClient();
  try {
    await redis.zincrby("trending:products", 1, String(productId));
  } catch (err) {
    console.error("[Cache] incrementTrendingView error:", err.message);
  }
}

async function incrementTrendingPurchase(productId, quantity = 1) {
  const redis = getRedisClient();
  try {
    // Purchases weighted 5x views — signals strong buying intent
    await redis.zincrby("trending:products", 5 * quantity, String(productId));
  } catch (err) {
    console.error("[Cache] incrementTrendingPurchase error:", err.message);
  }
}

async function getTrendingProducts(limit = 10) {
  const redis = getRedisClient();
  try {
    return await redis.zrevrange("trending:products", 0, limit - 1, "WITHSCORES");
  } catch (err) {
    console.error("[Cache] getTrendingProducts error:", err.message);
    return [];
  }
}

// ─── Leaderboards (Sorted Set) ────────────────────────────────────────────────

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function incrementSellerLeaderboard(sellerId, amount, month = currentMonth()) {
  const redis = getRedisClient();
  try {
    const key = `leaderboard:sellers:${month}`;
    await redis.zincrby(key, amount, String(sellerId));
    await redis.expire(key, 90 * 86400); // 90 days retention
  } catch (err) {
    console.error("[Cache] incrementSellerLeaderboard error:", err.message);
  }
}

async function incrementBuyerLeaderboard(userId, amount, month = currentMonth()) {
  const redis = getRedisClient();
  try {
    const key = `leaderboard:buyers:${month}`;
    await redis.zincrby(key, amount, String(userId));
    await redis.expire(key, 90 * 86400);
  } catch (err) {
    console.error("[Cache] incrementBuyerLeaderboard error:", err.message);
  }
}

async function getSellerLeaderboard(month = currentMonth(), limit = 10) {
  const redis = getRedisClient();
  try {
    return await redis.zrevrange(`leaderboard:sellers:${month}`, 0, limit - 1, "WITHSCORES");
  } catch (err) {
    console.error("[Cache] getSellerLeaderboard error:", err.message);
    return [];
  }
}

async function getBuyerLeaderboard(month = currentMonth(), limit = 10) {
  const redis = getRedisClient();
  try {
    return await redis.zrevrange(`leaderboard:buyers:${month}`, 0, limit - 1, "WITHSCORES");
  } catch (err) {
    console.error("[Cache] getBuyerLeaderboard error:", err.message);
    return [];
  }
}

// ─── HyperLogLog (unique visitors) ───────────────────────────────────────────

async function trackUniqueVisitor(productId, visitorId) {
  const redis = getRedisClient();
  try {
    await redis.pfadd(`hll:product:${productId}:views`, String(visitorId));
  } catch (err) {
    console.error("[Cache] trackUniqueVisitor error:", err.message);
  }
}

async function getUniqueVisitorCount(productId) {
  const redis = getRedisClient();
  try {
    return await redis.pfcount(`hll:product:${productId}:views`);
  } catch (err) {
    console.error("[Cache] getUniqueVisitorCount error:", err.message);
    return 0;
  }
}

// ─── Cache Stats ─────────────────────────────────────────────────────────────

async function getCacheStats() {
  const redis = getRedisClient();
  try {
    const info = await redis.info("all");
    const extract = (key) => {
      const match = info.match(new RegExp(`${key}:(\\S+)`));
      return match ? match[1] : "0";
    };
    const hits = parseInt(extract("keyspace_hits"), 10);
    const misses = parseInt(extract("keyspace_misses"), 10);
    const total = hits + misses;
    return {
      usedMemory: extract("used_memory_human"),
      usedMemoryPeak: extract("used_memory_peak_human"),
      connectedClients: parseInt(extract("connected_clients"), 10),
      keyspaceHits: hits,
      keyspaceMisses: misses,
      hitRatio: total > 0 ? ((hits / total) * 100).toFixed(2) + "%" : "N/A",
      totalCommandsProcessed: extract("total_commands_processed"),
      uptimeSeconds: extract("uptime_in_seconds"),
      redisVersion: extract("redis_version"),
    };
  } catch (err) {
    console.error("[Cache] getCacheStats error:", err.message);
    return { error: err.message };
  }
}

module.exports = {
  getCachedProduct,
  setCachedProduct,
  invalidateProductCache,
  acquireLock,
  releaseLock,
  setSession,
  getSession,
  deleteSession,
  getCart,
  setCartItem,
  removeCartItem,
  clearCart,
  mergeGuestCart,
  addRecentlyViewed,
  getRecentlyViewed,
  incrementTrendingView,
  incrementTrendingPurchase,
  getTrendingProducts,
  incrementSellerLeaderboard,
  incrementBuyerLeaderboard,
  getSellerLeaderboard,
  getBuyerLeaderboard,
  trackUniqueVisitor,
  getUniqueVisitorCount,
  getCacheStats,
  jitteredTTL,
};
