/**
 * IINA IPTV Plugin - Search Manager
 * @module managers/search
 * Optimized search with intelligent caching
 */

'use strict';

var stateModule = require('../core/state');
var helpers = require('../utils/helpers');

var state = stateModule.state;
var Logger = helpers.Logger;
var withTimeout = helpers.withTimeout;

// ============================================
// CONSTANTS
// ============================================

/** @const {number} Search cache TTL - 5 minutes */
var SEARCH_CACHE_TTL = 5 * 60 * 1000;

/** @const {number} Preload delay - 2 seconds */
var PRELOAD_DELAY = 2000;

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
var searchCache = {
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
  var now = Date.now();
  return (now - entry.timestamp) < SEARCH_CACHE_TTL;
}

/**
 * Get API action for stream type
 * @private
 * @param {string} type - Stream type (live, vod, series)
 * @returns {string|null} API action name
 */
function getApiAction(type) {
  var actions = {
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
    .filter(function(stream) {
      return stream.name && stream.name.toLowerCase().indexOf(query) !== -1;
    })
    .map(function(stream) {
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
  var lowerQuery = query.toLowerCase();
  
  return results.sort(function(a, b) {
    var aName = (a.name || '').toLowerCase();
    var bName = (b.name || '').toLowerCase();
    
    // Exact match first
    var aExact = aName === lowerQuery;
    var bExact = bName === lowerQuery;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    // Starts with query second
    var aStarts = aName.indexOf(lowerQuery) === 0;
    var bStarts = bName.indexOf(lowerQuery) === 0;
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
  
  var cacheEntry = searchCache[type];
  if (!cacheEntry) {
    throw new Error('Invalid stream type: ' + type);
  }
  
  // Return cached data if valid
  if (isCacheValid(cacheEntry)) {
    Logger.log('[Search] Using cached ' + type + ' streams');
    return cacheEntry.data;
  }
  
  // Fetch from API
  var action = getApiAction(type);
  if (!action) {
    throw new Error('Unknown stream type: ' + type);
  }
  
  Logger.log('[Search] Fetching ' + type + ' streams from API');
  
  try {
    var streams = await withTimeout(
      state.api.request(action),
      10000,
      'Loading ' + type + ' streams'
    );
    
    if (!Array.isArray(streams)) {
      throw new Error('Invalid response from server');
    }
    
    // Update cache
    cacheEntry.data = streams;
    cacheEntry.timestamp = Date.now();
    
    Logger.log('[Search] Cached ' + type + ' streams (' + streams.length + ' items)');
    return streams;
  } catch (e) {
    Logger.error('[Search] Failed to fetch ' + type + ': ' + e.message);
    // Return stale cache if available
    if (cacheEntry.data) {
      Logger.log('[Search] Using stale cache for ' + type);
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
      Logger.log('[Search] Invalidated cache for ' + type);
    }
  } else {
    Object.keys(searchCache).forEach(function(key) {
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
  
  Logger.log('[Search] Queueing preload for: ' + types.join(', '));
  
  types.forEach(function(type) {
    if (state.preloadingQueue.indexOf(type) === -1) {
      state.preloadingQueue.push(type);
    }
  });
  
  // Process queue with delay
  setTimeout(function() {
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
    var type = state.preloadingQueue.shift();
    
    // Skip if already cached
    if (isCacheValid(searchCache[type])) {
      continue;
    }
    
    try {
      await getCachedStreams(type);
    } catch (e) {
      Logger.error('[Search] Preload failed for ' + type + ': ' + e.message);
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
  
  var trimmedQuery = query.toLowerCase().trim();
  if (trimmedQuery.length < 2) {
    return [];
  }
  
  var opts = options || {};
  var types = opts.types || ['live', 'vod', 'series'];
  var limit = opts.limit || stateModule.MAX_SEARCH_RESULTS;
  
  Logger.log('[Search] Searching for: "' + trimmedQuery + '" in ' + types.join(', '));
  
  var allResults = [];
  
  // Fetch and search each type
  for (var i = 0; i < types.length; i++) {
    var type = types[i];
    
    try {
      var streams = await getCachedStreams(type);
      var typeResults = searchInData(streams, trimmedQuery, type);
      
      // Limit results per type
      if (typeResults.length > limit) {
        typeResults = typeResults.slice(0, limit);
      }
      
      allResults = allResults.concat(typeResults);
      Logger.log('[Search] Found ' + typeResults.length + ' ' + type + ' results');
    } catch (e) {
      Logger.error('[Search] Failed to search ' + type + ': ' + e.message);
    }
  }
  
  // Sort by relevance and limit total results
  var sortedResults = sortByRelevance(allResults, trimmedQuery);
  var finalResults = sortedResults.slice(0, limit);
  
  Logger.log('[Search] Total results: ' + finalResults.length);
  
  return finalResults;
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  var stats = {};
  
  Object.keys(searchCache).forEach(function(type) {
    var entry = searchCache[type];
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
  SEARCH_CACHE_TTL: SEARCH_CACHE_TTL,
  getCachedStreams: getCachedStreams,
  invalidateSearchCache: invalidateSearchCache,
  preloadSearchData: preloadSearchData,
  performSearch: performSearch,
  getCacheStats: getCacheStats
};
