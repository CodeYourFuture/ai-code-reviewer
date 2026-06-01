// auto-cleanup-cache.js
// TTL cache with automatic background cleanup

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class AutoCleanupCache<K = unknown, V = unknown> {
  cache: Map<K, CacheEntry<V>>;
  defaultTTL: number;
  cleanupInterval: number;
  cleanupTimer: ReturnType<typeof setInterval> | null;

  constructor(defaultTTL = 60000, cleanupInterval = 30000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this.cleanupInterval = cleanupInterval;
    this.cleanupTimer = null;

    // Start the cleanup interval
    this.startCleanup();
  }

  set(key: K, value: V, ttl: number = this.defaultTTL): void {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  // Remove all expired entries from the cache
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  // Start the automatic cleanup interval
  startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);

    // Allow the Node.js process to exit even if the timer is running
    this.cleanupTimer.unref();
  }

  // Stop the automatic cleanup
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // Properly dispose of the cache
  destroy(): void {
    this.stopCleanup();
    this.cache.clear();
  }
}
