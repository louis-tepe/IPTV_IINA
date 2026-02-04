/**
 * IINA IPTV Plugin - Cache Manager
 * @module managers/cache
 */

'use strict';

var state = require('../core/state').state;
var PLUGIN_VERSION = require('../core/state').PLUGIN_VERSION;
var CACHE_TTL = require('../core/state').CACHE_TTL;
var MAX_CACHE_ITEMS = require('../core/state').MAX_CACHE_ITEMS;
var VIRTUAL_SCROLL_THRESHOLD = require('../core/state').VIRTUAL_SCROLL_THRESHOLD;
var VIRTUAL_ITEM_HEIGHT = require('../core/state').VIRTUAL_ITEM_HEIGHT;
var Logger = require('../utils/helpers').Logger;

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
  var isValid = (Date.now() - cacheEntry.timestamp) < CACHE_TTL;
  if (isValid) {
    var age = Math.round((Date.now() - cacheEntry.timestamp) / 1000);
    Logger.log('[Cache] HIT - Data valid (age: ' + age + 's)');
  } else {
    var expired = Math.round((Date.now() - cacheEntry.timestamp) / 1000);
    Logger.log('[Cache] MISS - Cache expired (expired: ' + expired + 's ago)');
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
  return type + ':' + categoryId;
}

/**
 * Limit cache data to prevent memory bloat
 * @param {Array} data - Array to limit
 * @returns {Array} Limited array (max MAX_CACHE_ITEMS)
 */
function limitCacheData(data) {
  if (!Array.isArray(data)) return data;
  if (data.length <= MAX_CACHE_ITEMS) return data;

  Logger.log('[Cache] Limiting data from ' + data.length + ' to ' + MAX_CACHE_ITEMS + ' items');
  return data.slice(0, MAX_CACHE_ITEMS);
}

/**
 * Update cache with memory limit enforcement
 * @param {string} cacheKey - Cache key
 * @param {Array} data - Data to cache
 * @returns {Array} Limited data
 */
function updateCache(cacheKey, data) {
  var limitedData = limitCacheData(data);
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
    Logger.log('[Request] Reusing in-flight request for: ' + key);
    return state.inFlightRequests[key];
  }

  // Create new request and track it
  var promise = requestFn().finally(function() {
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
  setTimeout(function() {
    state.api.request('get_vod_categories').then(function(categories) {
      if (Array.isArray(categories)) {
        state.cache.vodCategories = {
          data: categories,
          timestamp: Date.now()
        };
        saveCache();
        Logger.log('[Preload] VOD categories preloaded: ' + categories.length + ' items');
      }
    }).catch(function(err) {
      // Silent fail - preloading is optional
      Logger.log('[Preload] VOD preload failed (non-critical): ' + err.message);
    }).finally(function() {
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

  setTimeout(function() {
    state.api.request('get_series_categories').then(function(categories) {
      if (Array.isArray(categories)) {
        state.cache.seriesCategories = {
          data: categories,
          timestamp: Date.now()
        };
        saveCache();
        Logger.log('[Preload] Series categories preloaded: ' + categories.length + ' items');
      }
    }).catch(function(err) {
      Logger.log('[Preload] Series preload failed (non-critical): ' + err.message);
    }).finally(function() {
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

  var cacheKey, action;
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
  var cacheEntry = state.cache[cacheKey];
  if (cacheEntry && cacheEntry.data) {
    var age = Date.now() - cacheEntry.timestamp;
    var refreshThreshold = CACHE_TTL * 0.5; // Refresh at 50% of TTL

    if (age > refreshThreshold && age < CACHE_TTL) {
      Logger.log('[Cache] Background refreshing ' + type + ' categories');

      // Use deduplication to prevent multiple refresh requests
      var refreshKey = 'refresh:' + type;
      deduplicateRequest(refreshKey, function() {
        return state.api.request(action).then(function(data) {
          if (Array.isArray(data)) {
            state.cache[cacheKey] = {
              data: data,
              timestamp: Date.now()
            };
            saveCache();
            Logger.log('[Cache] Background refresh complete for ' + type);
          }
          return data;
        });
      }).catch(function(err) {
        Logger.log('[Cache] Background refresh failed (non-critical): ' + err.message);
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
    var cacheToSave = {
      liveCategories: state.cache.liveCategories,
      vodCategories: state.cache.vodCategories,
      seriesCategories: state.cache.seriesCategories,
      streams: {},
      savedAt: Date.now(),
      version: PLUGIN_VERSION
    };

    // Only save stream cache metadata (not full data) to stay within storage limits
    var streamCacheKeys = Object.keys(state.cache.streams);
    if (streamCacheKeys.length > 10) {
      // Only persist metadata for the 10 most recently used streams
      streamCacheKeys.sort(function(a, b) {
        var timeA = state.cache.streams[a].timestamp || 0;
        var timeB = state.cache.streams[b].timestamp || 0;
        return timeB - timeA;
      });
      streamCacheKeys = streamCacheKeys.slice(0, 10);
    }

    streamCacheKeys.forEach(function(key) {
      cacheToSave.streams[key] = state.cache.streams[key];
    });

    if (typeof iina !== 'undefined' && iina.preferences) {
      iina.preferences.set('iptv_cache', JSON.stringify(cacheToSave));
    }
    Logger.log('[Cache] Saved to persistent storage');
  } catch (e) {
    Logger.error('[Cache] Failed to save: ' + e.message);
  }
}

/**
 * Restore cache from storage on startup
 */
function restoreCache() {
  try {
    if (typeof iina === 'undefined' || !iina.preferences) return;
    
    var saved = iina.preferences.get('iptv_cache');
    if (saved) {
      var parsed = JSON.parse(saved);

      // Check if cache is not too old (max 24 hours)
      var maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (parsed.savedAt && (Date.now() - parsed.savedAt) < maxAge) {
        // Restore category caches
        if (parsed.liveCategories) state.cache.liveCategories = parsed.liveCategories;
        if (parsed.vodCategories) state.cache.vodCategories = parsed.vodCategories;
        if (parsed.seriesCategories) state.cache.seriesCategories = parsed.seriesCategories;

        // Restore stream caches
        if (parsed.streams) {
          Object.keys(parsed.streams).forEach(function(key) {
            state.cache.streams[key] = parsed.streams[key];
          });
        }

        Logger.log('[Cache] Restored from persistent storage (saved at: ' + new Date(parsed.savedAt).toLocaleString() + ')');
      } else {
        Logger.log('[Cache] Saved cache is too old, ignoring');
      }
    }
  } catch (e) {
    Logger.error('[Cache] Failed to restore: ' + e.message);
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
  CACHE_TTL: CACHE_TTL,
  MAX_CACHE_ITEMS: MAX_CACHE_ITEMS,
  VIRTUAL_SCROLL_THRESHOLD: VIRTUAL_SCROLL_THRESHOLD,
  VIRTUAL_ITEM_HEIGHT: VIRTUAL_ITEM_HEIGHT,
  isCacheValid: isCacheValid,
  getStreamCacheKey: getStreamCacheKey,
  limitCacheData: limitCacheData,
  updateCache: updateCache,
  deduplicateRequest: deduplicateRequest,
  preloadVodCategories: preloadVodCategories,
  preloadSeriesCategories: preloadSeriesCategories,
  backgroundCacheRefresh: backgroundCacheRefresh,
  saveCache: saveCache,
  restoreCache: restoreCache,
  clearCache: clearCache
};
