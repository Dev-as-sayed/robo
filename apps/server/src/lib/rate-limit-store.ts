import type { Options, Store } from "express-rate-limit";
import { createClient } from "redis";

interface RedisLike {
  incr(key: string): Promise<number>;
  pExpire(key: string, milliseconds: number): Promise<boolean>;
  decr(key: string): Promise<number>;
  del(key: string): Promise<number>;
  quit?(): Promise<string>;
}

interface HybridStoreOptions {
  url?: string;
  prefix: string;
  connect?: (url: string) => Promise<RedisLike>;
}

interface MemoryEntry {
  count: number;
  resetAt: number;
}

async function connectRedis(url: string): Promise<RedisLike> {
  const client = createClient({ url });
  client.on("error", () => {
    // The store falls back to memory counters; avoid crashing on transient Redis errors.
  });
  await client.connect();
  return client as unknown as RedisLike;
}

/**
 * Redis-backed counters with an in-memory fallback. The fallback keeps a single VPS
 * working during a Redis restart and makes local development work without Redis.
 */
export class HybridRateLimitStore implements Store {
  readonly localKeys = false;

  readonly prefix: string;
  private readonly connect: (url: string) => Promise<RedisLike>;
  private readonly url?: string;
  private readonly memory = new Map<string, MemoryEntry>();
  private redisPromise: Promise<RedisLike | null> | null = null;
  private windowMs = 60_000;

  constructor(options: HybridStoreOptions) {
    this.prefix = options.prefix;
    this.url = options.url;
    this.connect = options.connect ?? connectRedis;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private redis(): Promise<RedisLike | null> {
    if (!this.url) return Promise.resolve(null);
    if (!this.redisPromise) {
      this.redisPromise = this.connect(this.url).catch(() => null);
    }
    return this.redisPromise;
  }

  private memoryIncrement(key: string): MemoryEntry {
    const now = Date.now();
    const current = this.memory.get(key);

    if (!current || current.resetAt <= now) {
      const next = { count: 1, resetAt: now + this.windowMs };
      this.memory.set(key, next);
      return next;
    }

    current.count += 1;
    return current;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const fullKey = `${this.prefix}${key}`;
    const redis = await this.redis();

    if (redis) {
      try {
        const totalHits = await redis.incr(fullKey);
        if (totalHits === 1) {
          await redis.pExpire(fullKey, this.windowMs);
        }
        return {
          totalHits,
          resetTime: new Date(Date.now() + this.windowMs),
        };
      } catch {
        this.redisPromise = Promise.resolve(null);
      }
    }

    const entry = this.memoryIncrement(fullKey);
    return { totalHits: entry.count, resetTime: new Date(entry.resetAt) };
  }

  async decrement(key: string): Promise<void> {
    const fullKey = `${this.prefix}${key}`;
    const redis = await this.redis();

    if (redis) {
      try {
        await redis.decr(fullKey);
        return;
      } catch {
        this.redisPromise = Promise.resolve(null);
      }
    }

    const entry = this.memory.get(fullKey);
    if (entry && entry.count > 0) {
      entry.count -= 1;
    }
  }

  async resetKey(key: string): Promise<void> {
    const fullKey = `${this.prefix}${key}`;
    this.memory.delete(fullKey);

    const redis = await this.redis();
    if (redis) {
      try {
        await redis.del(fullKey);
      } catch {
        this.redisPromise = Promise.resolve(null);
      }
    }
  }

  async shutdown(): Promise<void> {
    const redis = await this.redisPromise;
    if (redis?.quit) {
      await redis.quit().catch(() => undefined);
    }
  }
}
