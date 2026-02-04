/**
 * IINA IPTV Plugin - Cache Manager
 * @module managers/cache
 */

'use strict';

const { state, PLUGIN_VERSION, CACHE_TTL, MAX_CACHE_ITEMS, VIRTUAL_SCROLL_THRESHOLD, VIRTUAL_ITEM_HEIGHT } = require('../core/state');
const { Logger } = require('../utils/helpers');

/**
 * Check if cache is valid
 * @param {Object} cacheEntry - Cache entry with data and timestamp
 * @returns {boolean}
 */
function isCacheValid(cacheEntry) {
  if (!cacheEntry || !cacheEntry.data) {
    Logger.log('[Cache] MISS - No cache entry or data');
    return false;
  }
  const isValid = (Date.now() - cacheEntry.timestamp) < CACHE_TTL;
  if (isValid) {
    const age = Math.round((Date.now() - cacheEntry.timestamp) / 1000);
    Logger.log(`[Cache] HIT - Data valid (age: ${age}s)`);
  } else {
    const expired = Math.round((Date.now() - cacheEntry.timestamp) / 1000);
    Logger.log(`[Cache] MISS - Cache expired (expired: ${expired}s ago)`);
  }
  return isValid;
}

/**
 * Get cache key for streams
 * @param {string} type - Content type
 * @param {string} categoryId - Category ID
 * @returns {string}
 */
function getStreamCacheKey(type, categoryId) {
  return `${type}:${categoryId}`;
}

/**
 * Limit cache data to prevent memory bloat
 * @param {Array} data - Array to limit
 * @returns {Array} Limited array (max MAX_CACHE_ITEMS)
 */
function limitCacheData(data) {
  if (!Array.isArray(data)) return data;
  if (data.length <= MAX_CACHE_ITEMS) return data;

  Logger.log(`[Cache] Limiting data from ${data.length} to ${MAX_CACHE_ITEMS} items`);
  return data.slice(0, MAX_CACHE_ITEMS);
}

/**
 * Update cache with memory limit enforcement
 * @param {string} cacheKey - Cache key
 * @param {Array} data - Data to cache
 * @returns {Array} Limited data
 */
function updateCache(cacheKey, data) {
  const limitedData = limitCacheData(data);
  state.cache.streams[cacheKey] = {
    data: limitedData,
    timestamp: Date.now()
  };
  saveCache();
  return limitedData;
}

/**
 * Request deduplication: Get or create request promise
 * @param {string} key - Request key
 * @param {Function} requestFn - Function that returns a promise
 * @returns {Promise}
 */
function deduplicateRequest(key, requestFn) {
  // If request is already in flight, return the same promise
  if (state.inFlightRequests[key]) {
    Logger.log(`[Request] Reusing in-flight request for: ${key}`);
    return state.inFlightRequests[key];
  }

  // Create new request and track it
  const promise = requestFn().finally(() => {
    // Clean up after request completes
    delete state.inFlightRequests[key];
  });

  state.inFlightRequests[key] = promise;
  return promise;
}

/**
 * Preload VOD categories in background when user views Live TV
 */
function preloadVodCategories() {
  if (!state.api || state.isPreloading) return;

  // Only preload if VOD categories aren't already cached
  if (isCacheValid(state.cache.vodCategories)) {
    return;
  }

  Logger.log('[Preload] Starting background preload of VOD categories');
  state.isPreloading = true;

  // Use setTimeout to not block main operations
  setTimeout(() => {
    state.api.request('get_vod_categories').then((categories) => {
      if (Array.isArray(categories)) {
        state.cache.vodCategories = {
          data: categories,
          timestamp: Date.now()
        };
        saveCache();
        Logger.log(`[Preload] VOD categories preloaded: ${categories.length} items`);
      }
    }).catch((err) => {
      // Silent fail - preloading is optional
      Logger.log(`[Preload] VOD preload failed (non-critical): ${err.message}`);
    }).finally(() => {
      state.isPreloading = false;
    });
  }, 2000); // Delay 2s to prioritize current user action
}

/**
 * Preload series categories in background
 */
function preloadSeriesCategories() {
  if (!state.api || state.isPreloading) return;

  if (isCacheValid(state.cache.seriesCategories)) {
    return;
  }

  Logger.log('[Preload] Starting background preload of Series categories');
  state.isPreloading = true;

  setTimeout(() => {
    state.api.request('get_series_categories').then((categories) => {
      if (Array.isArray(categories)) {
        state.cache.seriesCategories = {
          data: categories,
          timestamp: Date.now()
        };
        saveCache();
        Logger.log(`[Preload] Series categories preloaded: ${categories.length} items`);
      }
    }).catch((err) => {
      Logger.log(`[Preload] Series preload failed (non-critical): ${err.message}`);
    }).finally(() => {
      state.isPreloading = false;
    });
  }, 4000); // Delay 4s to spread out background requests
}

/**
 * Background cache refresh - refreshes stale data without blocking UI
 * @param {string} type - Content type to refresh
 */
function backgroundCacheRefresh(type) {
  if (!state.api) return;

  let cacheKey, action;
  if (type === 'live') {
    cacheKey = 'liveCategories';
    action = 'get_live_categories';
  } else if (type === 'vod') {
    cacheKey = 'vodCategories';
    action = 'get_vod_categories';
  } else if (type === 'series') {
    cacheKey = 'seriesCategories';
    action = 'get_series_categories';
  } else {
    return;
  }

  // Check if cache exists but might be stale soon (refresh when > 50% of TTL elapsed)
  const cacheEntry = state.cache[cacheKey];
  if (cacheEntry && cacheEntry.data) {
    const age = Date.now() - cacheEntry.timestamp;
    const refreshThreshold = CACHE_TTL * 0.5; // Refresh at 50% of TTL

    if (age > refreshThreshold && age < CACHE_TTL) {
      Logger.log(`[Cache] Background refreshing ${type} categories`);

      // Use deduplication to prevent multiple refresh requests
      const refreshKey = `refresh:${type}`;
      deduplicateRequest(refreshKey, () => {
        return state.api.request(action).then((data) => {
          if (Array.isArray(data)) {
            state.cache[cacheKey] = {
              data: data,
              timestamp: Date.now()
            };
            saveCache();
            Logger.log(`[Cache] Background refresh complete for ${type}`);
          }
          return data;
        });
      }).catch((err) => {
        Logger.log(`[Cache] Background refresh failed (non-critical): ${err.message}`);
      });
    }
  }
}

/**
 * Save cache to storage (persistent across sessions)
 */
function saveCache() {
  try {
    // Create a trimmed version of cache for persistence
    const cacheToSave = {
      liveCategories: state.cache.liveCategories,
      vodCategories: state.cache.vodCategories,
      seriesCategories: state.cache.seriesCategories,
      streams: {},
      savedAt: Date.now(),
      version: PLUGIN_VERSION
    };

    // Only save stream cache metadata (not full data) to stay within storage limits
    let streamCacheKeys = Object.keys(state.cache.streams);
    if (streamCacheKeys.length > 10) {
      // Only persist metadata for the 10 most recently used streams
      streamCacheKeys.sort((a, b) => {
        const timeA = state.cache.streams[a].timestamp || 0;
        const timeB = state.cache.streams[b].timestamp || 0;
        return timeB - timeA;
      });
      streamCacheKeys = streamCacheKeys.slice(0, 10);
    }

    streamCacheKeys.forEach((key) => {
      cacheToSave.streams[key] = state.cache.streams[key];
    });

    if (typeof iina !== 'undefined' && iina.preferences) {
      iina.preferences.set('iptv_cache', JSON.stringify(cacheToSave));
    }
    Logger.log('[Cache] Saved to persistent storage');
  } catch (e) {
    Logger.error(`[Cache] Failed to save: ${e.message}`);
  }
}

/**
 * Restore cache from storage on startup
 */
function restoreCache() {
  try {
    if (typeof iina === 'undefined' || !iina.preferences) return;
    
    const saved = iina.preferences.get('iptv_cache');
    if (saved) {
      const parsed = JSON.parse(saved);

      // Check if cache is not too old (max 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (parsed.savedAt && (Date.now() - parsed.savedAt) < maxAge) {
        // Restore category caches
        if (parsed.liveCategories) state.cache.liveCategories = parsed.liveCategories;
        if (parsed.vodCategories) state.cache.vodCategories = parsed.vodCategories;
        if (parsed.seriesCategories) state.cache.seriesCategories = parsed.seriesCategories;

        // Restore stream caches
        if (parsed.streams) {
          Object.keys(parsed.streams).forEach((key) => {
            state.cache.streams[key] = parsed.streams[key];
          });
        }

        Logger.log(`[Cache] Restored from persistent storage (saved at: ${new Date(parsed.savedAt).toLocaleString()})`);
      } else {
        Logger.log('[Cache] Saved cache is too old, ignoring');
      }
    }
  } catch (e) {
    Logger.error(`[Cache] Failed to restore: ${e.message}`);
  }
}

/**
 * Clear all cache
 */
function clearCache() {
  state.cache = {
    liveCategories: { data: null, timestamp: 0 },
    vodCategories: { data: null, timestamp: 0 },
    seriesCategories: { data: null, timestamp: 0 },
    streams: {}
  };

  try {
    if (typeof iina !== 'undefined' && iina.preferences) {
      iina.preferences.set('iptv_cache', null);
    }
  } catch (e) {
    // Ignore
  }
}

module.exports = {
  CACHE_TTL,
  MAX_CACHE_ITEMS,
  VIRTUAL_SCROLL_THRESHOLD,
  VIRTUAL_ITEM_HEIGHT,
  isCacheValid,
  getStreamCacheKey,
  limitCacheData,
  updateCache,
  deduplicateRequest,
  preloadVodCategories,
  preloadSeriesCategories,
  backgroundCacheRefresh,
  saveCache,
  restoreCache,
  clearCache
};
