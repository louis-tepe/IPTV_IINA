/**
 * IINA IPTV Plugin - Global Entry Point (Refactored)
 * v8.0.0 - Modular Architecture
 * 
 * Refactored from monolithic 2674 lines to modular structure
 * @author IPTV Plugin Developer
 * @version 8.0.0
 */

'use strict';

// ============================================
// MODULE IMPORTS
// ============================================

var stateModule = require('./src/core/state');
var i18n = require('./src/core/i18n');
var helpers = require('./src/utils/helpers');
var storage = require('./src/managers/storage');
var cache = require('./src/managers/cache');
var xtream = require('./src/api/xtream');
var search = require('./src/managers/search');

// ============================================
// EXPORTS FROM MODULES
// ============================================

var DEBUG = stateModule.DEBUG;
var LOG_PREFIX = stateModule.LOG_PREFIX;
var PLUGIN_VERSION = stateModule.PLUGIN_VERSION;
var XtreamAPI = xtream.XtreamAPI;
var withTimeout = helpers.withTimeout;

var state = stateModule.state;
var messageHandlersSetup = stateModule.messageHandlersSetup;

var loadCredentials = storage.loadCredentials;
var saveCredentials = storage.saveCredentials;
var clearCredentials = storage.clearCredentials;
var loadFavorites = storage.loadFavorites;
var saveFavorites = storage.saveFavorites;
var loadHistory = storage.loadHistory;
var updateResumePosition = storage.updateResumePosition;
var getResumePosition = storage.getResumePosition;

var isCacheValid = cache.isCacheValid;
var getStreamCacheKey = cache.getStreamCacheKey;
var updateCache = cache.updateCache;
var deduplicateRequest = cache.deduplicateRequest;
var preloadVodCategories = cache.preloadVodCategories;
var preloadSeriesCategories = cache.preloadSeriesCategories;
var backgroundCacheRefresh = cache.backgroundCacheRefresh;
var saveCache = cache.saveCache;
var restoreCache = cache.restoreCache;
var clearCache = cache.clearCache;
var VIRTUAL_SCROLL_THRESHOLD = cache.VIRTUAL_SCROLL_THRESHOLD;
var VIRTUAL_ITEM_HEIGHT = cache.VIRTUAL_ITEM_HEIGHT;

// ============================================
// IINA MODULE ALIASES
// ============================================

var win = iina.standaloneWindow;
var prefs = iina.preferences;
var menu = iina.menu;

// Always log startup
iina.console.log('[IPTV] Plugin v' + PLUGIN_VERSION + ' loaded (modular)');

// ============================================
// LOGGING SYSTEM
// ============================================

function log(msg) {
  if (!DEBUG) return;
  var m = LOG_PREFIX + ' ' + msg;
  iina.console.log(m);
  if (win && typeof win.postMessage === 'function') {
    try { win.postMessage('log', m); } catch (e) {}
  }
}

function logError(msg) {
  var m = LOG_PREFIX + ' ERROR: ' + msg;
  iina.console.error(m);
  if (DEBUG && win && typeof win.postMessage === 'function') {
    try { win.postMessage('log', '❌ ' + m); } catch (e) {}
  }
}

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================

if (typeof process !== 'undefined' && process.on) {
  process.on('unhandledRejection', function(reason) {
    var errorMsg = 'Unhandled Promise Rejection: ' + (reason && reason.message ? reason.message : String(reason));
    logError(errorMsg);
    try { if (win) win.postMessage('error', 'Internal error: ' + errorMsg); } catch (e) {}
  });
  
  process.on('uncaughtException', function(error) {
    logError('UNCAUGHT EXCEPTION: ' + error.message);
    try { if (win) win.postMessage('error', 'Critical error: ' + error.message); } catch (e) {}
  });
}

// ============================================
// RESUME POSITION SYNC (Event-Driven)
// ============================================

// Listen for position updates from main.js
iina.event.on('iptv.resumePositionUpdated', async function(data) {
  try {
    if (data && data.streamId && data.position > 0) {
      state.resumePositions[String(data.streamId)] = {
        position: data.position,
        duration: data.duration || 0,
        updatedAt: data.updatedAt || Date.now()
      };
      await storage.saveResumePositions();
      if (DEBUG) log('[Resume Position] Updated for stream ' + data.streamId + ': ' + data.position + 's');
    }
  } catch (e) {
    logError('[Resume Position] Failed to update: ' + e.message);
  }
});

// ============================================
// WINDOW MANAGEMENT
// ============================================

async function showWindow() {
  loadFavorites();
  await loadHistory();
  restoreCache();

  win.loadFile('ui/connection.html');
  win.setProperty({
    title: 'IPTV Player v' + PLUGIN_VERSION,
    resizable: true,
    fullSizeContentView: false,
    hideTitleBar: false
  });
  win.setFrame(420, 650);

  setupMessageHandlers();
  win.open();

  setTimeout(async function() {
    var creds = await loadCredentials();
    win.postMessage('init', {
      ...creds,
      translations: i18n.dictionaries[i18n.getLocale()]
    });
    if (creds.rememberMe && creds.server && creds.username && creds.password) {
      win.postMessage('autoConnect', creds);
    }
  }, 500);
}

function showBrowserPage() {
  win.loadFile('ui/browser.html');
  
  setTimeout(function() {
    messageHandlersSetup = false;
    setupMessageHandlers();
    
    try {
      win.postMessage('serverInfo', {
        name: state.credentials ? state.credentials.server : 'IPTV',
        version: PLUGIN_VERSION
      });
      win.postMessage('favorites', state.favorites);
      loadCategories('live');
    } catch (e) {
      logError('Error sending initial data: ' + e.message);
    }
  }, 200);
}

// ============================================
// MESSAGE HANDLERS
// ============================================

function setupMessageHandlers() {
  if (messageHandlersSetup) {
    if (DEBUG) log('setupMessageHandlers: Already called, skipping');
    return;
  }
  
  if (DEBUG) log('Setting up message handlers...');

  win.onMessage('ready', function() {
    if (DEBUG) log('Page ready - Frontend initialized');
    try {
      win.postMessage('backendReady', { version: PLUGIN_VERSION, timestamp: Date.now(), status: 'ok' });
    } catch (e) {}
  });

  win.onMessage('connect', function(data) { handleConnect(data); });
  win.onMessage('autoConnect', function(data) { handleConnect(data); });
  win.onMessage('disconnect', function() { handleDisconnect(); });

  win.onMessage('load', function(data) {
    if (DEBUG) log('[load] type: ' + (data ? data.type : 'null'));
    try {
      win.postMessage('loadReceived', { received: true, timestamp: Date.now(), type: data ? data.type : 'unknown' });
    } catch (e) {}
    handleLoad(data);
  });

  win.onMessage('play', function(data) {
    if (DEBUG) log('[play] id: ' + (data && data.id ? data.id : 'null'));
    try {
      win.postMessage('playReceived', { received: true, timestamp: Date.now() });
    } catch (e) {}
    try { handlePlay(data); } catch (e) { logError('[play] Exception: ' + e.message); }
  });

  win.onMessage('favorite', function(data) { handleFavorite(data); });
  win.onMessage('search', function(data) { handleSearch(data); });
  win.onMessage('getEpg', function(data) { handleGetEpg(data); });
  win.onMessage('clearCache', function() { clearCache(); });
  win.onMessage('loadSeriesInfo', function(data) {
    if (DEBUG) log('[loadSeriesInfo] seriesId: ' + (data && data.seriesId ? data.seriesId : 'null'));
    handleLoadSeriesInfo(data);
  });
  
  win.onMessage('updateResumePosition', function(data) {
    if (data && data.streamId && data.position !== undefined) {
      updateResumePosition(data.streamId, data.position, data.duration);
    }
  });
  
  win.onMessage('getResumePosition', function(data) {
    if (data && data.streamId) {
      var resumeData = getResumePosition(data.streamId);
      win.postMessage('resumePosition', { streamId: data.streamId, data: resumeData });
    }
  });
  
  win.onMessage('requestVirtualItems', function(data) {
    if (data && data.cacheKey && data.startIndex !== undefined && data.endIndex !== undefined) {
      var cacheEntry = state.cache.streams[data.cacheKey];
      if (cacheEntry && cacheEntry.data) {
        var items = cacheEntry.data.slice(data.startIndex, data.endIndex);
        win.postMessage('virtualItems', {
          cacheKey: data.cacheKey,
          startIndex: data.startIndex,
          items: items,
          totalCount: cacheEntry.data.length
        });
      }
    }
  });
  
  win.onMessage('saveCache', function() { saveCache(); });
  
  // i18n message handlers
  win.onMessage('i18n.getTranslations', function() {
    try {
      win.postMessage('i18n.translations', {
        locale: i18n.getLocale(),
        dictionary: i18n.dictionaries
      });
    } catch (e) {
      logError('[i18n] Failed to send translations: ' + e.message);
    }
  });
  
  win.onMessage('i18n.setLocale', function(data) {
    try {
      if (data && data.locale) {
        i18n.setLocale(data.locale);
        win.postMessage('i18n.translations', {
          locale: i18n.getLocale(),
          dictionary: i18n.dictionaries
        });
      }
    } catch (e) {
      logError('[i18n] Failed to set locale: ' + e.message);
    }
  });
  
  if (DEBUG) log('Message handlers registered');
  messageHandlersSetup = true;
}

// ============================================
// CONNECTION HANDLING
// ============================================

async function handleConnect(data) {
  var server = (data.server || '').trim();
  if (server.indexOf('http') !== 0) server = 'http://' + server;

  var creds = {
    server: server,
    username: (data.username || '').trim(),
    password: (data.password || '').trim()
  };

  if (!creds.server || !creds.username || !creds.password) {
    win.postMessage('error', 'Please fill in all fields');
    return;
  }

  state.api = new XtreamAPI(creds);

  try {
    var result = await state.api.request('get_live_categories');
    if (!Array.isArray(result)) throw new Error('Invalid response from server');

    state.isConnected = true;
    state.credentials = creds;
    
    var shouldRemember = data.rememberMe !== false;
    await saveCredentials(creds, shouldRemember);
    
    clearCache();
    search.invalidateSearchCache(null); // Invalidate all search cache on new connection
    win.postMessage('success');
    showBrowserPage();
  } catch (err) {
    logError('Connection failed: ' + err.message);
    state.api = null;
    win.postMessage('error', 'Connection failed: ' + err.message);
  }
}

async function handleDisconnect(clearCreds) {
  state.isConnected = false;
  state.api = null;
  state.credentials = null;
  
  if (clearCreds) await clearCredentials();
  clearCache();
  search.invalidateSearchCache(null); // Invalidate all search cache
  
  win.loadFile('ui/connection.html');
  setTimeout(async function() {
    var creds = await loadCredentials();
    win.postMessage('init', {
      ...creds,
      translations: i18n.dictionaries[i18n.getLocale()]
    });
  }, 300);
}

// ============================================
// CONTENT LOADING
// ============================================

async function handleLoad(data) {
  if (DEBUG) log('[handleLoad] type: ' + (data.type || 'undefined') + ', category: ' + (data.category || 'none'));
  
  var type = data.type;
  var cat = data.category;

  try {
    if (cat) {
      await loadStreams(type, cat);
    } else if (type === 'favorites') {
      win.postMessage('render', Object.values(state.favorites));
    } else if (type === 'history') {
      win.postMessage('history', state.history);
    } else {
      await loadCategories(type);
    }
  } catch (e) {
    logError('[handleLoad] Error: ' + e.message);
    try {
      if (cat) win.postMessage('render', []);
      else if (type === 'favorites' || type === 'history') win.postMessage('render', []);
      else win.postMessage('categories', []);
    } catch (postErr) {}
    try {
      win.postMessage('error', 'Failed to load content: ' + e.message);
    } catch (postErr) {}
  }
}

async function handleLoadSeriesInfo(data) {
  if (DEBUG) log('[handleLoadSeriesInfo] seriesId: ' + (data && data.seriesId ? data.seriesId : 'null'));
  
  if (!state.api || !data.seriesId) {
    logError('[handleLoadSeriesInfo] API not connected or missing seriesId');
    try { win.postMessage('error', 'Cannot load series: Not connected or missing ID'); } catch (e) {}
    return;
  }

  try {
    var seriesInfo = await state.api.request('get_series_info', { series_id: data.seriesId });
    if (!seriesInfo || !seriesInfo.episodes) throw new Error('No episodes found for this series');

    win.postMessage('seriesInfo', {
      seriesId: data.seriesId,
      name: seriesInfo.info.name || data.seriesName || 'Unknown Series',
      cover: seriesInfo.info.cover || '',
      plot: seriesInfo.info.plot || '',
      rating: seriesInfo.info.rating || '',
      genre: seriesInfo.info.genre || '',
      seasons: seriesInfo.episodes
    });
  } catch (e) {
    logError('[handleLoadSeriesInfo] Failed: ' + e.message);
    try { win.postMessage('error', 'Failed to load series: ' + e.message); } catch (err) {}
  }
}

async function loadCategories(type) {
  if (DEBUG) log('[loadCategories] type: ' + type);
  
  try {
    if (!state.api) { win.postMessage('categories', []); return; }

    var action, cacheKey;
    if (type === 'live') { action = 'get_live_categories'; cacheKey = 'liveCategories'; }
    else if (type === 'vod') { action = 'get_vod_categories'; cacheKey = 'vodCategories'; }
    else if (type === 'series') { action = 'get_series_categories'; cacheKey = 'seriesCategories'; }
    else { logError('[loadCategories] Unknown type: ' + type); win.postMessage('categories', []); return; }

    if (isCacheValid(state.cache[cacheKey])) {
      win.postMessage('categories', state.cache[cacheKey].data);
      backgroundCacheRefresh(type);
      if (type === 'live') { 
        preloadVodCategories(); 
        preloadSeriesCategories();
        search.preloadSearchData(['vod', 'series']); // Preload search data
      }
      return;
    }

    var cats = await deduplicateRequest('categories:' + type, function() {
      return withTimeout(state.api.request(action), 10000, 'Loading ' + type + ' categories');
    });

    if (!cats || !Array.isArray(cats)) throw new Error('Invalid response from server');

    state.cache[cacheKey] = { data: cats, timestamp: Date.now() };
    saveCache();
    win.postMessage('categories', cats);
    
    if (type === 'live') { 
      preloadVodCategories(); 
      preloadSeriesCategories();
      search.preloadSearchData(['vod', 'series']); // Preload search data
    }
  } catch (e) {
    logError('[loadCategories] Failed: ' + e.message);
    try { win.postMessage('categories', []); } catch (postErr) {}
    try { win.postMessage('error', 'Failed to load ' + type + ' categories: ' + e.message); } catch (postErr) {}
  }
}

async function loadStreams(type, catId) {
  if (DEBUG) log('[loadStreams] type: ' + type + ', catId: ' + catId);
  
  try {
    if (!state.api) { win.postMessage('render', []); return; }

    var action;
    if (type === 'live') action = 'get_live_streams';
    else if (type === 'vod') action = 'get_vod_streams';
    else if (type === 'series') action = 'get_series';
    else { logError('[loadStreams] Unknown type: ' + type); win.postMessage('render', []); return; }

    var cacheKey = getStreamCacheKey(type, catId);
    if (isCacheValid(state.cache.streams[cacheKey])) {
      var cachedData = state.cache.streams[cacheKey].data;
      if (cachedData.length > VIRTUAL_SCROLL_THRESHOLD) {
        win.postMessage('renderVirtual', { items: cachedData, totalCount: cachedData.length, itemHeight: VIRTUAL_ITEM_HEIGHT, threshold: VIRTUAL_SCROLL_THRESHOLD });
      } else {
        win.postMessage('render', cachedData);
      }
      return;
    }

    var streams = await deduplicateRequest(action + ':' + catId, function() {
      return withTimeout(state.api.request(action, { category_id: catId }), 10000, 'Loading ' + type + ' streams');
    });

    if (!streams || !Array.isArray(streams)) throw new Error('Invalid response from server');

    var limitedStreams = updateCache(cacheKey, streams);

    if (limitedStreams.length > VIRTUAL_SCROLL_THRESHOLD) {
      win.postMessage('renderVirtual', { items: limitedStreams, totalCount: limitedStreams.length, itemHeight: VIRTUAL_ITEM_HEIGHT, threshold: VIRTUAL_SCROLL_THRESHOLD });
    } else {
      win.postMessage('render', limitedStreams);
    }
  } catch (e) {
    logError('[loadStreams] Failed: ' + e.message);
    try { win.postMessage('render', []); } catch (postErr) {}
    try { win.postMessage('error', 'Failed to load ' + type + ' streams: ' + e.message); } catch (postErr) {}
  }
}

// ============================================
// PLAYBACK & FAVORITES
// ============================================

async function handlePlay(data) {
  if (!data) { logError('[handlePlay] No data provided'); return; }
  if (!state.api) { logError('[handlePlay] No API instance'); return; }
  if (!data.id) { logError('[handlePlay] No stream ID'); return; }
  
  var id = data.id, type = data.type, ext = data.ext, name = data.name, resumePosition = data.resumePosition;
  
  if (DEBUG) log('[handlePlay] id: ' + id + ', type: ' + type);
  
  if (type === 'series' && !data.directStream) {
    try {
      var seriesInfo = await state.api.request('get_series_info', { series_id: id });
      if (!seriesInfo || !seriesInfo.episodes) throw new Error('No episodes found');
      var seasons = Object.keys(seriesInfo.episodes).sort();
      if (seasons.length === 0) throw new Error('No seasons found');
      var firstSeason = seriesInfo.episodes[seasons[0]];
      if (!firstSeason || firstSeason.length === 0) throw new Error('No episodes in first season');
      var firstEpisode = firstSeason[0];
      id = firstEpisode.id || firstEpisode.stream_id;
      ext = firstEpisode.container_extension || ext;
      name = firstEpisode.title || name;
    } catch (e) { logError('[handlePlay] Series error: ' + e.message); return; }
  }
  
  if (!id) { logError('[handlePlay] Empty ID after processing'); return; }
  
  var url;
  try { url = state.api.getStreamUrl(id, type, ext); } catch (e) { logError('[handlePlay] URL build error: ' + e.message); return; }
  
  var historyItem = { id: id, name: name || 'Unknown', type: type, thumbnail: data.thumbnail || data.stream_icon || data.cover || '', container_extension: ext, rating: data.rating || '', plot: data.plot || '' };
  if (data.series_id) historyItem.series_id = data.series_id;
  
  await storage.addToHistory(historyItem);
  
  try { iina.event.emit('iptv.play', { url: url, name: name, type: type, streamId: id, resumePosition: resumePosition, timestamp: Date.now() }); }
  catch (e) { logError('[handlePlay] Failed to emit play: ' + e.message); }
}

function handleFavorite(data) {
  if (!data || !data.id) return;
  
  var id = data.id, type = data.type || 'unknown', name = data.name || 'Unknown';
  
  if (state.favorites[id]) delete state.favorites[id];
  else state.favorites[id] = { id: id, type: type, name: name, addedAt: Date.now() };
  
  saveFavorites();
  win.postMessage('favorites', state.favorites);
}

// ============================================
// SEARCH
// ============================================

async function handleSearch(data) {
  if (!state.api) { win.postMessage('render', []); return; }

  var query = (data.query || '').trim();
  if (query.length < 2) { win.postMessage('render', []); return; }

  if (state.searchDebounceTimer) clearTimeout(state.searchDebounceTimer);

  state.searchDebounceTimer = setTimeout(async function() {
    try {
      var results = await search.performSearch(query, {
        types: ['live', 'vod', 'series'],
        limit: stateModule.MAX_SEARCH_RESULTS
      });
      win.postMessage('render', results);
    } catch (e) {
      logError('Search failed: ' + e.message);
      win.postMessage('render', []);
    }
  }, 300);
}

// ============================================
// EPG
// ============================================

async function handleGetEpg(data) {
  if (!state.api || !data || !data.streamId) {
    win.postMessage('epgData', { error: 'Invalid request' });
    return;
  }

  try {
    var epgData = await state.api.getEpg(data.streamId);
    win.postMessage('epgData', { streamId: data.streamId, data: epgData });
  } catch (e) {
    logError('[EPG] Failed: ' + e.message);
    win.postMessage('epgData', { streamId: data.streamId, error: e.message });
  }
}

// ============================================
// MENU REGISTRATION
// ============================================

try {
  if (typeof iina.menu === 'undefined' || typeof iina.menu.item !== 'function' || typeof iina.menu.addItem !== 'function') {
    throw new Error('Menu API not available');
  }
  var menuItem = iina.menu.item('Open IPTV', showWindow, { key: 'i', modifiers: ['cmd'] });
  if (menuItem) {
    iina.menu.addItem(menuItem);
    if (DEBUG) log('Menu item registered');
  }
} catch (menuError) {
  logError('Menu registration failed: ' + menuError.message);
}

iina.console.log('[IPTV] Plugin v' + PLUGIN_VERSION + ' ready (modular)');
