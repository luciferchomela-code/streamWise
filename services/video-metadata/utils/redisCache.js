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
        connectTimeout: 2000,
        // Fixed: retry 3 times with exponential backoff (200ms, 400ms, 600ms) then give up.
        // The app keeps working without Redis thanks to the non-fatal design.
        reconnectStrategy: (retries) =>
          retries < 3 ? Math.min(retries * 200, 1000) : false,
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

/**
 * Bumps the namespace version, making ALL keys in that namespace stale instantly.
 * This is the cheapest form of bulk invalidation — no key scanning needed.
 * Used for global feeds (trending, popular) where many keys share a namespace.
 */
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

/**
 * Write-through invalidation: deletes a specific cache key immediately after a write.
 * Used to prevent dirty reads on individual resources (single video, channel video list).
 *
 * Example: user edits video title → MongoDB updated → deleteCache("streamwise:video:abc123")
 * → next visitor gets a cache MISS → fresh, correct data is fetched from MongoDB.
 */
export const deleteCache = async (key) => {
  const redis = await getRedisClient();
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    warnCacheFailure("delete", error);
    return false;
  }
};

/**
 * Deletes ALL cache keys that start with a given prefix using Redis SCAN.
 * Used to invalidate an entire channel's paginated video list at once.
 *
 * Example: channel uploads a new video → all keys starting with
 * "streamwise:channel-videos:CHANNELID:" are deleted → all pages are refreshed.
 *
 * NOTE: We use SCAN (not KEYS) because KEYS blocks Redis on large datasets.
 */
export const deleteCacheByPrefix = async (prefix) => {
  const redis = await getRedisClient();
  if (!redis) return false;

  try {
    let cursor = 0;
    do {
      const reply = await redis.scan(cursor, { MATCH: `${prefix}*`, COUNT: 100 });
      cursor = reply.cursor;
      if (reply.keys.length > 0) {
        await redis.del(reply.keys);
      }
    } while (cursor !== 0);
    return true;
  } catch (error) {
    warnCacheFailure("delete-by-prefix", error);
    return false;
  }
};