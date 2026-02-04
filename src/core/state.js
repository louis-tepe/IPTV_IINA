/**
 * IINA IPTV Plugin - Global State
 * @module core/state
 */

'use strict';

// ============================================
// CONSTANTS
// ============================================

/** @const {boolean} */
var DEBUG = false;

/** @const {string} */
var LOG_PREFIX = '[IPTV]';

/** @const {string} */
var PLUGIN_VERSION = '8.0.0';

/** @const {number} */
var REQUEST_TIMEOUT = 30000; // 30 seconds

/** @const {number} */
var MAX_HISTORY_ITEMS = 50;

/** @const {number} */
var MAX_SEARCH_RESULTS = 50;

/** @const {number} */
var CACHE_TTL = 600000; // 10 minutes cache

/** @const {number} */
var MAX_CACHE_ITEMS = 1000; // Maximum items per cache entry

/** @const {number} */
var VIRTUAL_SCROLL_THRESHOLD = 50; // Items threshold for virtual scrolling

/** @const {number} */
var VIRTUAL_ITEM_HEIGHT = 120; // Pixels per item

// ============================================
// MESSAGE HANDLER STATE
// ============================================

/** @type {boolean} */
var messageHandlersSetup = false;

// ============================================
// GLOBAL PLUGIN STATE
// ============================================

/**
 * Global plugin state
 * @typedef {Object} PluginState
 * @property {Object|null} api - API client instance
 * @property {boolean} isConnected - Connection status
 * @property {Object|null} credentials - User credentials
 * @property {Object} favorites - Favorites map by ID
 * @property {Array} history - Watch history
 * @property {Object} resumePositions - Resume positions for VOD
 * @property {Object} cache - Data cache with timestamps
 * @property {number|null} searchDebounceTimer - Search debounce timer
 * @property {Object} inFlightRequests - Request deduplication
 * @property {Array} preloadingQueue - Background preloading queue
 * @property {boolean} isPreloading - Preloading status
 */

/** @type {PluginState} */
var state = {
  api: null,
  isConnected: false,
  credentials: null,
  favorites: {},
  history: [],
  resumePositions: {},
  cache: {
    liveCategories: { data: null, timestamp: 0 },
    vodCategories: { data: null, timestamp: 0 },
    seriesCategories: { data: null, timestamp: 0 },
    streams: {}
  },
  searchDebounceTimer: null,
  inFlightRequests: {},
  preloadingQueue: [],
  isPreloading: false
};

// Load debug preference
try {
  if (typeof iina !== 'undefined' && iina.preferences) {
    var debugPref = iina.preferences.get('iptv_debug');
    if (debugPref === 'true') {
      DEBUG = true;
    }
  }
} catch (e) {
  // Ignore
}

module.exports = {
  DEBUG: DEBUG,
  LOG_PREFIX: LOG_PREFIX,
  PLUGIN_VERSION: PLUGIN_VERSION,
  REQUEST_TIMEOUT: REQUEST_TIMEOUT,
  MAX_HISTORY_ITEMS: MAX_HISTORY_ITEMS,
  MAX_SEARCH_RESULTS: MAX_SEARCH_RESULTS,
  CACHE_TTL: CACHE_TTL,
  MAX_CACHE_ITEMS: MAX_CACHE_ITEMS,
  VIRTUAL_SCROLL_THRESHOLD: VIRTUAL_SCROLL_THRESHOLD,
  VIRTUAL_ITEM_HEIGHT: VIRTUAL_ITEM_HEIGHT,
  messageHandlersSetup: messageHandlersSetup,
  state: state
};
