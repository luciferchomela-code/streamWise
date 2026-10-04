import { createClient } from "redis";

const CACHE_VERSION_PREFIX = "streamwise:cache-version:";

const isRedisEnabled = () =>
  process.env.USE_REDIS === "true" || Boolean(process.env.REDIS_URL);

let client;
let connectionPromise;
let lastWarningAt = 0;
let retryConnectionAfter = 0;

const warnCacheFailure = (operation, error) => {
  const now = Date.now();
  if (now - lastWarningAt >= 30_000) {
    console.warn(`[Redis cache] ${operation} failed; continuing without cache: ${error.message}`);
    lastWarningAt = now;
  }
};

const getRedisClient = async () => {
  if (!isRedisEnabled()) return null;
  if (Date.now() < retryConnectionAfter) return null;

  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        connectTimeout: 1000,
        reconnectStrategy: (retries) => (retries < 1 ? 100 : false),
      },
    });
    client.on("error", (error) => warnCacheFailure("connection", error));
  }

  if (client.isReady) return client;

  if (!connectionPromise) {
    connectionPromise = client.connect()
      .then(() => {
        retryConnectionAfter = 0;
        return client;
      })
      .catch((error) => {
        warnCacheFailure("connect", error);
        retryConnectionAfter = Date.now() + 5000;
        return null;
      })
      .finally(() => {
        connectionPromise = null;
      });
  }

  return connectionPromise;
};

/**
 * Load JSON data from Redis or compute it and cache it for the given TTL.
 * Cache failures are deliberately non-fatal: the loader remains the source of truth.
 */
export const getOrSetJsonCache = async ({ key, ttlSeconds, loader }) => {
  const redis = await getRedisClient();
  if (!redis) {
    return { value: await loader(), cacheStatus: "BYPASS" };
  }

  try {
    const cachedValue = await redis.get(key);
    if (cachedValue !== null) {
      try {
        return { value: JSON.parse(cachedValue), cacheStatus: "HIT" };
      } catch (error) {
        warnCacheFailure("deserialize", error);
        await redis.del(key).catch(() => {});
      }
    }
  } catch (error) {
    warnCacheFailure("read", error);
  }

  const value = await loader();

  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    warnCacheFailure("write", error);
  }

  return { value, cacheStatus: "MISS" };
};

/** A shared version keeps feed keys global while allowing inexpensive invalidation. */
export const getCacheNamespaceVersion = async (namespace) => {
  const redis = await getRedisClient();
  if (!redis) return "bypass";

  try {
    return (await redis.get(`${CACHE_VERSION_PREFIX}${namespace}`)) || "0";
  } catch (error) {
    warnCacheFailure("read version", error);
    return "bypass";
  }
};

export const invalidateCacheNamespace = async (namespace) => {
  const redis = await getRedisClient();
  if (!redis) return false;

  try {
    await redis.incr(`${CACHE_VERSION_PREFIX}${namespace}`);
    return true;
  } catch (error) {
    warnCacheFailure("invalidate", error);
    return false;
  }
};