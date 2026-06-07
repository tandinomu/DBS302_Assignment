const {
  getCachedProduct,
  setCachedProduct,
  acquireLock,
  releaseLock,
} = require("../services/cacheService");
const Product = require("../models/Product");

/**
 * Cache-aside middleware for GET /products/:id
 *
 * Flow:
 *  1. Check Redis for product:{id}
 *  2. HIT  → return cached data immediately
 *  3. MISS → acquire distributed lock (SET NX EX 5)
 *       Acquired  → fetch from MongoDB, store in Redis, release lock
 *       Not acquired (another request is loading) → wait 100ms and retry
 *       (request coalescing — prevents multiple DB hits for the same key)
 *
 * Jittered TTL applied inside setCachedProduct to prevent thundering herd.
 */
async function productCacheMiddleware(req, res, next) {
  const { id } = req.params;

  try {
    const cached = await getCachedProduct(id);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json({ success: true, data: cached, source: "cache" });
    }

    res.setHeader("X-Cache", "MISS");

    // Attempt to acquire lock to prevent cache stampede
    const lockKey = `product:${id}`;
    const lockAcquired = await acquireLock(lockKey, 5);

    if (lockAcquired) {
      try {
        const product = await Product.findById(id)
          .populate("category", "name slug")
          .populate("seller", "name email")
          .lean()
          .maxTimeMS(5000);

        if (!product) {
          return res.status(404).json({ error: "Product not found" });
        }

        await setCachedProduct(id, product);
        // Attach product to req so the controller can add extra fields (uniqueVisitors etc.)
        req.cachedProduct = product;
        return next();
      } finally {
        await releaseLock(lockKey);
      }
    } else {
      // Another request is fetching — wait 100ms and retry once from cache
      await new Promise((resolve) => setTimeout(resolve, 100));
      const retried = await getCachedProduct(id);
      if (retried) {
        res.setHeader("X-Cache", "HIT-COALESCED");
        return res.json({ success: true, data: retried, source: "cache" });
      }
      // Still not cached — fall through to controller
      return next();
    }
  } catch (err) {
    // Cache layer failure must never crash the request
    console.error("[CacheMiddleware] Error:", err.message);
    next();
  }
}

module.exports = { productCacheMiddleware };
