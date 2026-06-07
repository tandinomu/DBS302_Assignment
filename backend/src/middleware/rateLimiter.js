const { getRedisClient } = require("../config/redis");

/**
 * Factory that returns an Express middleware enforcing a sliding-window rate limit
 * using Redis INCR + EXPIRE.
 *
 * Pattern:
 *   Key: ratelimit:{ip}:{endpoint}  (or ratelimit:{userId}:{endpoint} when authenticated)
 *   On each request: INCR the key. On first increment (returns 1), set EXPIRE.
 *   If count > limit: return 429.
 *
 * @param {number} limit         Max allowed requests in the window
 * @param {number} windowSeconds Time window in seconds
 * @param {string} identifier    'ip' | 'user' — how to identify the client
 */
function rateLimiter(limit, windowSeconds, identifier = "ip") {
  return async (req, res, next) => {
    const redis = getRedisClient();
    try {
      const clientId =
        identifier === "user" && req.user
          ? req.user.userId
          : req.ip || req.headers["x-forwarded-for"] || "unknown";

      const endpoint = req.path.replace(/\//g, "_");
      const key = `ratelimit:${clientId}:${endpoint}`;

      const count = await redis.incr(key);

      if (count === 1) {
        // First request in this window — set the expiry atomically
        await redis.expire(key, windowSeconds);
      }

      // Set headers so clients can see their remaining quota
      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - count));

      if (count > limit) {
        const ttl = await redis.ttl(key);
        res.setHeader("Retry-After", ttl);
        return res.status(429).json({
          error: "Too many requests. Please try again later.",
          retryAfter: ttl,
        });
      }

      next();
    } catch (err) {
      // Redis failure must not block the request — fail open
      console.error("[RateLimiter] Redis error:", err.message);
      next();
    }
  };
}

module.exports = rateLimiter;
