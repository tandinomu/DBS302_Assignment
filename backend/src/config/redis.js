const Redis = require("ioredis");

let redisClient = null;

function parseSentinelHosts(hostsEnv) {
  // Format: "host1:port1,host2:port2,host3:port3"
  return hostsEnv.split(",").map((entry) => {
    const [host, port] = entry.trim().split(":");
    return { host, port: parseInt(port, 10) };
  });
}

function createRedisClient() {
  const sentinelHostsEnv = process.env.REDIS_SENTINEL_HOSTS;
  const sentinelName = process.env.REDIS_SENTINEL_NAME || "mymaster";

  let client;

  if (sentinelHostsEnv) {
    // Production: connect via Sentinel for automatic failover
    const sentinels = parseSentinelHosts(sentinelHostsEnv);
    client = new Redis({
      sentinels,
      name: sentinelName,
      // ioredis will auto-promote a sentinel-elected master
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) return null; // stop retrying after 10 attempts
        return Math.min(times * 100, 3000);
      },
      reconnectOnError(err) {
        const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });
  } else {
    // Development fallback: direct connection
    client = new Redis({
      host: process.env.REDIS_HOST || "redis-master",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) return null;
        return Math.min(times * 100, 3000);
      },
    });
  }

  client.on("connect", () => console.info("[Redis] Connected"));
  client.on("ready", () => console.info("[Redis] Ready"));
  client.on("error", (err) => console.error("[Redis] Error:", err.message));
  client.on("close", () => console.warn("[Redis] Connection closed"));
  client.on("+failover-end", () => console.info("[Redis] Sentinel failover complete"));

  return client;
}

function getRedisClient() {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

async function getRedisStatus() {
  const client = getRedisClient();
  try {
    await client.ping();
    return { status: "healthy", connected: true };
  } catch (err) {
    return { status: "unhealthy", connected: false, error: err.message };
  }
}

module.exports = { getRedisClient, getRedisStatus };
