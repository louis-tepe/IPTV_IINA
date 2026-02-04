/**
 * IINA IPTV Plugin - Global State
 * @module core/state
 */

'use strict';

// ============================================
// CONSTANTS
// ============================================

/** @const {boolean} */
let DEBUG = false;

/** @const {string} */
const LOG_PREFIX = '[IPTV]';

/** @const {string} */
const PLUGIN_VERSION = '8.0.0';

/** @const {number} */
const REQUEST_TIMEOUT = 30000; // 30 seconds

/** @const {number} */
const MAX_HISTORY_ITEMS = 50;

/** @const {number} */
const MAX_SEARCH_RESULTS = 50;

/** @const {number} */
const CACHE_TTL = 600000; // 10 minutes cache

/** @const {number} */
const MAX_CACHE_ITEMS = 1000; // Maximum items per cache entry

/** @const {number} */
const VIRTUAL_SCROLL_THRESHOLD = 50; // Items threshold for virtual scrolling

/** @const {number} */
const VIRTUAL_ITEM_HEIGHT = 120; // Pixels per item

// ============================================
// MESSAGE HANDLER STATE
// ============================================

/** @type {boolean} */
const messageHandlersSetup = false;

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
const state = {
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
    const debugPref = iina.preferences.get('iptv_debug');
    if (debugPref === 'true') {
      DEBUG = true;
    }
  }
} catch (e) {
  // Ignore
}

module.exports = {
  DEBUG,
  LOG_PREFIX,
  PLUGIN_VERSION,
  REQUEST_TIMEOUT,
  MAX_HISTORY_ITEMS,
  MAX_SEARCH_RESULTS,
  CACHE_TTL,
  MAX_CACHE_ITEMS,
  VIRTUAL_SCROLL_THRESHOLD,
  VIRTUAL_ITEM_HEIGHT,
  messageHandlersSetup,
  state
};
