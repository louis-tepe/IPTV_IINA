/**
 * IINA IPTV Plugin - Search Manager
 * @module managers/search
 * Optimized search with intelligent caching
 */

'use strict';

const { state, MAX_SEARCH_RESULTS } = require('../core/state');
const { Logger, withTimeout } = require('../utils/helpers');

// ============================================
// CONSTANTS
// ============================================

/** @const {number} Search cache TTL - 5 minutes */
const SEARCH_CACHE_TTL = 5 * 60 * 1000;

/** @const {number} Preload delay - 2 seconds */
const PRELOAD_DELAY = 2000;

// ============================================
// SEARCH CACHE
// ============================================

/**
 * Search cache structure
 * @typedef {Object} SearchCacheEntry
 * @property {Array|null} data - Cached stream data
 * @property {number} timestamp - Cache timestamp
 */

/** @type {Object.<string, SearchCacheEntry>} */
const searchCache = {
  live: { data: null, timestamp: 0 },
  vod: { data: null, timestamp: 0 },
  series: { data: null, timestamp: 0 }
};

// ============================================
// PRIVATE FUNCTIONS
// ============================================

/**
 * Check if cache entry is valid
 * @private
 * @param {SearchCacheEntry} entry - Cache entry to check
 * @returns {boolean} True if cache is valid
 */
function isCacheValid(entry) {
  if (!entry || !entry.data) return false;
  const now = Date.now();
  return (now - entry.timestamp) < SEARCH_CACHE_TTL;
}

/**
 * Get API action for stream type
 * @private
 * @param {string} type - Stream type (live, vod, series)
 * @returns {string|null} API action name
 */
function getApiAction(type) {
  const actions = {
    live: 'get_live_streams',
    vod: 'get_vod_streams',
    series: 'get_series'
  };
  return actions[type] || null;
}

/**
 * Perform search on cached data
 * @private
 * @param {Array} data - Data to search through
 * @param {string} query - Search query (lowercased)
 * @param {string} type - Stream type for tagging
 * @returns {Array} Filtered and tagged results
 */
function searchInData(data, query, type) {
  if (!Array.isArray(data)) return [];
  
  return data
    .filter(stream => stream.name && stream.name.toLowerCase().indexOf(query) !== -1)
    .map(stream => {
      stream.searchType = type;
      return stream;
    });
}

/**
 * Sort search results by relevance
 * @private
 * @param {Array} results - Results to sort
 * @param {string} query - Original query for exact matching
 * @returns {Array} Sorted results
 */
function sortByRelevance(results, query) {
  const lowerQuery = query.toLowerCase();
  
  return results.sort((a, b) => {
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    
    // Exact match first
    const aExact = aName === lowerQuery;
    const bExact = bName === lowerQuery;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    // Starts with query second
    const aStarts = aName.indexOf(lowerQuery) === 0;
    const bStarts = bName.indexOf(lowerQuery) === 0;
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    
    // Alphabetical order
    return aName.localeCompare(bName);
  });
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Get cached streams or fetch from API
 * @param {string} type - Stream type (live, vod, series)
 * @returns {Promise<Array>} Stream data
 */
async function getCachedStreams(type) {
  if (!state.api) {
    throw new Error('API not connected');
  }
  
  const cacheEntry = searchCache[type];
  if (!cacheEntry) {
    throw new Error(`Invalid stream type: ${type}`);
  }
  
  // Return cached data if valid
  if (isCacheValid(cacheEntry)) {
    Logger.log(`[Search] Using cached ${type} streams`);
    return cacheEntry.data;
  }
  
  // Fetch from API
  const action = getApiAction(type);
  if (!action) {
    throw new Error(`Unknown stream type: ${type}`);
  }
  
  Logger.log(`[Search] Fetching ${type} streams from API`);
  
  try {
    const streams = await withTimeout(
      state.api.request(action),
      10000,
      `Loading ${type} streams`
    );
    
    if (!Array.isArray(streams)) {
      throw new Error('Invalid response from server');
    }
    
    // Update cache
    cacheEntry.data = streams;
    cacheEntry.timestamp = Date.now();
    
    Logger.log(`[Search] Cached ${type} streams (${streams.length} items)`);
    return streams;
  } catch (e) {
    Logger.error(`[Search] Failed to fetch ${type}: ${e.message}`);
    // Return stale cache if available
    if (cacheEntry.data) {
      Logger.log(`[Search] Using stale cache for ${type}`);
      return cacheEntry.data;
    }
    throw e;
  }
}

/**
 * Invalidate search cache for specific type or all
 * @param {string|null} type - Stream type to invalidate, or null for all
 */
function invalidateSearchCache(type) {
  if (type) {
    if (searchCache[type]) {
      searchCache[type].data = null;
      searchCache[type].timestamp = 0;
      Logger.log(`[Search] Invalidated cache for ${type}`);
    }
  } else {
    Object.keys(searchCache).forEach(key => {
      searchCache[key].data = null;
      searchCache[key].timestamp = 0;
    });
    Logger.log('[Search] Invalidated all search cache');
  }
}

/**
 * Preload search data in background
 * @param {Array<string>} types - Types to preload (default: ['vod', 'series'])
 */
function preloadSearchData(types) {
  if (!types) {
    types = ['vod', 'series'];
  }
  
  if (!state.api || state.isPreloading) {
    return;
  }
  
  Logger.log(`[Search] Queueing preload for: ${types.join(', ')}`);
  
  types.forEach(type => {
    if (state.preloadingQueue.indexOf(type) === -1) {
      state.preloadingQueue.push(type);
    }
  });
  
  // Process queue with delay
  setTimeout(() => {
    processPreloadQueue();
  }, PRELOAD_DELAY);
}

/**
 * Process preloading queue
 * @private
 */
async function processPreloadQueue() {
  if (state.isPreloading || state.preloadingQueue.length === 0) {
    return;
  }
  
  state.isPreloading = true;
  
  while (state.preloadingQueue.length > 0) {
    const type = state.preloadingQueue.shift();
    
    // Skip if already cached
    if (isCacheValid(searchCache[type])) {
      continue;
    }
    
    try {
      await getCachedStreams(type);
    } catch (e) {
      Logger.error(`[Search] Preload failed for ${type}: ${e.message}`);
    }
  }
  
  state.isPreloading = false;
}

/**
 * Perform optimized search with caching
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {Array<string>} options.types - Stream types to search
 * @param {number} options.limit - Max results per type
 * @returns {Promise<Array>} Search results
 */
async function performSearch(query, options) {
  if (!query || typeof query !== 'string') {
    return [];
  }
  
  const trimmedQuery = query.toLowerCase().trim();
  if (trimmedQuery.length < 2) {
    return [];
  }
  
  const opts = options || {};
  const types = opts.types || ['live', 'vod', 'series'];
  const limit = opts.limit || MAX_SEARCH_RESULTS;
  
  Logger.log(`[Search] Searching for: "${trimmedQuery}" in ${types.join(', ')}`);
  
  let allResults = [];
  
  // Fetch and search each type
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    
    try {
      const streams = await getCachedStreams(type);
      let typeResults = searchInData(streams, trimmedQuery, type);
      
      // Limit results per type
      if (typeResults.length > limit) {
        typeResults = typeResults.slice(0, limit);
      }
      
      allResults = allResults.concat(typeResults);
      Logger.log(`[Search] Found ${typeResults.length} ${type} results`);
    } catch (e) {
      Logger.error(`[Search] Failed to search ${type}: ${e.message}`);
    }
  }
  
  // Sort by relevance and limit total results
  const sortedResults = sortByRelevance(allResults, trimmedQuery);
  const finalResults = sortedResults.slice(0, limit);
  
  Logger.log(`[Search] Total results: ${finalResults.length}`);
  
  return finalResults;
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  const stats = {};
  
  Object.keys(searchCache).forEach(type => {
    const entry = searchCache[type];
    stats[type] = {
      hasData: entry.data !== null,
      itemCount: entry.data ? entry.data.length : 0,
      age: entry.timestamp > 0 ? Date.now() - entry.timestamp : 0,
      isValid: isCacheValid(entry)
    };
  });
  
  return stats;
}

module.exports = {
  SEARCH_CACHE_TTL,
  getCachedStreams,
  invalidateSearchCache,
  preloadSearchData,
  performSearch,
  getCacheStats
};
