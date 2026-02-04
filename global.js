/**
 * IINA IPTV Plugin - Global Entry Point (Menu-based UI)
 * Works with IINA 1.4.1 - No window/sidebar APIs available
 * Uses menu-based interface with console output
 */

'use strict';

iina.console.log('[IPTV Global] Plugin loaded - Menu-based interface');

// ============================================================================
// Configuration & State
// ============================================================================

var CONFIG = {
  server: '',
  username: '',
  password: ''
};

var STATE = {
  categories: { live: [], vod: [], series: [] },
  streams: { live: {}, vod: {}, series: {} },
  currentCategory: null
};

// ============================================================================
// Utility Functions
// ============================================================================

function loadConfig() {
  try {
    var saved = iina.preferences.get('iptv_config');
    if (saved) {
      CONFIG = JSON.parse(saved);
      iina.console.log('[IPTV Global] Configuration loaded');
    }
  } catch (e) {
    iina.console.error('[IPTV Global] Failed to load config: ' + e.message);
  }
}

function saveConfig() {
  try {
    iina.preferences.set('iptv_config', JSON.stringify(CONFIG));
    // Sync to disk immediately for persistence
    if (typeof iina.preferences.sync === 'function') {
      iina.preferences.sync();
    }
    iina.console.log('[IPTV Global] Configuration saved and synced');
  } catch (e) {
    iina.console.error('[IPTV Global] Failed to save config: ' + e.message);
  }
}

function buildApiUrl(action, params) {
  if (!CONFIG.server || !CONFIG.username || !CONFIG.password) {
    return null;
  }
  
  // Keep HTTP - requests go through WebView which allows insecure connections
  var server = CONFIG.server;
  
  var url = server + '/player_api.php?username=' + CONFIG.username + '&password=' + CONFIG.password;
  if (action) url += '&action=' + action;
  if (params) {
    for (var k in params) {
      url += '&' + k + '=' + encodeURIComponent(params[k]);
    }
  }
  return url;
}

// ============================================================================
// API Request (WebView Proxy for ATS bypass)
// ============================================================================
// iina.http is blocked by macOS App Transport Security for HTTP (non-HTTPS)
// URLs. WebViews can bypass ATS, so we route requests through the connection
// window's JavaScript context which has access to fetch() without ATS blocking.

var pendingRequests = {};
var requestIdCounter = 0;

function apiRequest(action, params, callback) {
  var url = buildApiUrl(action, params);
  if (!url) {
    callback(new Error('Not configured - Please set credentials first'));
    return;
  }
  
  iina.console.log('[IPTV API] Request: ' + (action || 'user_info'));
  iina.console.log('[IPTV API] URL: ' + url.replace(/password=[^&]+/, 'password=***'));
  iina.console.log('[IPTV API] Routing through WebView proxy (ATS bypass)');
  
  // Generate unique request ID
  var requestId = 'req_' + (++requestIdCounter) + '_' + Date.now();
  pendingRequests[requestId] = callback;
  
  // Send request through WebView (which can make HTTP requests without ATS blocking)
  iina.standaloneWindow.postMessage('api_request', {
    requestId: requestId,
    url: url
  });
  
  // Timeout after 30 seconds
  setTimeout(function() {
    if (pendingRequests[requestId]) {
      iina.console.error('[IPTV API] Request timeout after 30s');
      delete pendingRequests[requestId];
      callback(new Error('Request timeout - server did not respond'));
    }
  }, 30000);
}

function getStreamUrl(id, type, ext) {
  ext = ext || 'ts';
  return CONFIG.server + '/' + type + '/' + CONFIG.username + '/' + CONFIG.password + '/' + id + '.' + ext;
}

function triggerPlayback(url, name, type, streamId) {
  var playRequest = {
    url: url,
    name: name,
    type: type,
    streamId: streamId,
    timestamp: Date.now()
  };
  
  // Use preferences-based communication (works in IINA 1.4.1)
  iina.preferences.set('iptv_play_request', JSON.stringify(playRequest));
  iina.console.log('[IPTV Global] Playing: ' + name);
}

// ============================================================================
// Window Management (Single main.html handles both connection and browser views)
// ============================================================================

var windowReady = false;

// Load main HTML at plugin init (IINA pattern - load ONCE, never switch)
iina.standaloneWindow.loadFile('ui/main.html');
iina.console.log('[IPTV Global] Main HTML pre-loaded');

function openMainWindow(autoConnect) {
  iina.console.log('[IPTV Global] Opening main window...');
  iina.standaloneWindow.setProperty('title', 'IPTV Player');
  iina.standaloneWindow.open();
  
  // Send init with config after a short delay
  setTimeout(function() {
    iina.console.log('[IPTV Global] Sending init to main window');
    iina.standaloneWindow.postMessage('init', {
      server: CONFIG.server || '',
      username: CONFIG.username || '',
      password: CONFIG.password || '',
      autoConnect: autoConnect && CONFIG.server && CONFIG.username
    });
  }, 300);
}

function openBrowserWindow() {
  iina.console.log('[IPTV Global] Opening browser...');
  openMainWindow(true); // Auto-connect if configured
}

function openConnectionWindow() {
  iina.console.log('[IPTV Global] Opening connection window...');
  openMainWindow(false); // Show connection form
}

// ============================================================================
// Message Handlers (Simplified for unified main.html)
// ============================================================================

iina.standaloneWindow.onMessage('ready', function(data) {
  iina.console.log('[IPTV Global] Window ready signal received');
  windowReady = true;
});

iina.standaloneWindow.onMessage('save_config', function(data) {
  if (!data) return;
  iina.console.log('[IPTV Global] Saving config from main window');
  CONFIG.server = data.server;
  CONFIG.username = data.username;
  CONFIG.password = data.password;
  saveConfig();
});

iina.standaloneWindow.onMessage('play', function(data) {
  if (!data) return;
  iina.console.log('[IPTV Global] Play request: ' + data.name);
  triggerPlayback(data.url, data.name, data.type, data.id);
});

// HTTP Proxy handler (for ATS bypass - main.html uses this for API calls)
iina.standaloneWindow.onMessage('api_request', function(data) {
  iina.console.log('[IPTV Global] Proxying API request');
  // This is handled directly by main.html's fetch, but kept for compatibility
});

// ============================================================================
// API Response Handler (for connection.html compatibility)
// ============================================================================

iina.standaloneWindow.onMessage('api_response', function(data) {
  iina.console.log('[IPTV API] Response received');
  
  if (!data || !data.requestId) {
    iina.console.error('[IPTV API] Invalid response - no requestId');
    return;
  }
  
  // Check browser pending requests first
  var callback = browserPendingRequests[data.requestId];
  if (callback) {
    delete browserPendingRequests[data.requestId];
    
    if (!data.success) {
      callback(new Error(data.error || 'Network error'));
      return;
    }
    
    try {
      var parsed = JSON.parse(data.text);
      callback(null, parsed);
    } catch (e) {
      callback(new Error('Invalid JSON'));
    }
    return;
  }
  
  // Fallback to connection pending requests
  callback = pendingRequests[data.requestId];
  if (callback) {
    delete pendingRequests[data.requestId];
    
    if (!data.success) {
      callback(new Error(data.error || 'Network error'));
      return;
    }
    
    try {
      var parsed = JSON.parse(data.text);
      if (parsed.user_info && parsed.user_info.auth === 0) {
        callback(new Error('Authentication failed'));
        return;
      }
      callback(null, parsed);
    } catch (e) {
      callback(new Error('Invalid server response'));
    }
  }
});

// ============================================================================
// Connection Handling
// ============================================================================

function handleConnectAction(data) {
  if (!data) return;
  
  CONFIG.server = data.server;
  CONFIG.username = data.username;
  CONFIG.password = data.password;
  iina.console.log('[IPTV Global] Testing connection to: ' + CONFIG.server);
  saveConfig();
  
  apiRequest(null, null, function(err, result) {
    if (err) {
      iina.console.error('[IPTV Global] Connection failed: ' + err.message);
      iina.standaloneWindow.postMessage('error', { message: 'Connection failed: ' + err.message });
    } else {
      iina.console.log('[IPTV Global] Connection successful!');
      iina.standaloneWindow.postMessage('success', {});
      
      setTimeout(function() {
        iina.standaloneWindow.close();
        // Open browser after successful connection
        openBrowserWindow();
      }, 500);
    }
  });
}



// ============================================================================
// Menu Actions
// ============================================================================

function actionConfigure() {
  openConnectionWindow();
}

function actionLiveCategories() {
  apiRequest('get_live_categories', null, function(err, data) {
    if (err) return;
    
    STATE.categories.live = data;
    iina.console.log('[IPTV] ========================================');
    iina.console.log('[IPTV] Live Categories (' + data.length + '):');
    iina.console.log('[IPTV] ========================================');
    
    for (var i = 0; i < Math.min(data.length, 50); i++) {
      iina.console.log('[IPTV]   [' + data[i].category_id + '] ' + data[i].category_name);
    }
    
    if (data.length > 50) {
      iina.console.log('[IPTV] ... and ' + (data.length - 50) + ' more');
    }
    
    iina.console.log('[IPTV] Use "Live Streams" to list channels in a category');
  });
}

function actionVODCategories() {
  apiRequest('get_vod_categories', null, function(err, data) {
    if (err) return;
    
    STATE.categories.vod = data;
    iina.console.log('[IPTV] ========================================');
    iina.console.log('[IPTV] VOD Categories (' + data.length + '):');
    iina.console.log('[IPTV] ========================================');
    
    for (var i = 0; i < Math.min(data.length, 50); i++) {
      iina.console.log('[IPTV]   [' + data[i].category_id + '] ' + data[i].category_name);
    }
    
    if (data.length > 50) {
      iina.console.log('[IPTV] ... and ' + (data.length - 50) + ' more');
    }
  });
}

function actionSeriesCategories() {
  apiRequest('get_series_categories', null, function(err, data) {
    if (err) return;
    
    STATE.categories.series = data;
    iina.console.log('[IPTV] ========================================');
    iina.console.log('[IPTV] Series Categories (' + data.length + '):');
    iina.console.log('[IPTV] ========================================');
    
    for (var i = 0; i < Math.min(data.length, 50); i++) {
      iina.console.log('[IPTV]   [' + data[i].category_id + '] ' + data[i].category_name);
    }
    
    if (data.length > 50) {
      iina.console.log('[IPTV] ... and ' + (data.length - 50) + ' more');
    }
  });
}

function actionLiveStreams() {
  apiRequest('get_live_streams', null, function(err, data) {
    if (err) return;
    
    STATE.streams.live = {};
    var streams = Array.isArray(data) ? data : [];
    
    iina.console.log('[IPTV] ========================================');
    iina.console.log('[IPTV] Live Streams (' + streams.length + '):');
    iina.console.log('[IPTV] ========================================');
    
    for (var i = 0; i < Math.min(streams.length, 100); i++) {
      var s = streams[i];
      STATE.streams.live[s.stream_id] = s;
      iina.console.log('[IPTV]   [' + s.stream_id + '] ' + s.name);
    }
    
    if (streams.length > 100) {
      iina.console.log('[IPTV] ... and ' + (streams.length - 100) + ' more');
    }
    
    iina.console.log('[IPTV] Use "Play Stream by ID" to play a specific stream');
  });
}

function actionVODStreams() {
  apiRequest('get_vod_streams', null, function(err, data) {
    if (err) return;
    
    STATE.streams.vod = {};
    var streams = Array.isArray(data) ? data : [];
    
    iina.console.log('[IPTV] ========================================');
    iina.console.log('[IPTV] VOD Streams (' + streams.length + '):');
    iina.console.log('[IPTV] ========================================');
    
    for (var i = 0; i < Math.min(streams.length, 100); i++) {
      var s = streams[i];
      STATE.streams.vod[s.stream_id] = s;
      iina.console.log('[IPTV]   [' + s.stream_id + '] ' + s.name);
    }
    
    if (streams.length > 100) {
      iina.console.log('[IPTV] ... and ' + (streams.length - 100) + ' more');
    }
  });
}

function actionSeriesStreams() {
  apiRequest('get_series', null, function(err, data) {
    if (err) return;
    
    STATE.streams.series = {};
    var series = Array.isArray(data) ? data : [];
    
    iina.console.log('[IPTV] ========================================');
    iina.console.log('[IPTV] Series (' + series.length + '):');
    iina.console.log('[IPTV] ========================================');
    
    for (var i = 0; i < Math.min(series.length, 100); i++) {
      var s = series[i];
      STATE.streams.series[s.series_id] = s;
      iina.console.log('[IPTV]   [' + s.series_id + '] ' + s.name);
    }
    
    if (series.length > 100) {
      iina.console.log('[IPTV] ... and ' + (series.length - 100) + ' more');
    }
  });
}

function actionSearch(query) {
  if (!query) {
    iina.console.log('[IPTV] Usage: Search requires a query string');
    return;
  }
  
  iina.console.log('[IPTV] Searching for: ' + query);
  iina.console.log('[IPTV] (Search not implemented in menu version)');
}

function actionHelp() {
  iina.console.log('[IPTV] ========================================');
  iina.console.log('[IPTV] IPTV Plugin Help');
  iina.console.log('[IPTV] ========================================');
  iina.console.log('[IPTV] Available commands:');
  iina.console.log('[IPTV]   Configure     - Setup credentials');
  iina.console.log('[IPTV]   Live Cats      - List live categories');
  iina.console.log('[IPTV]   Live Streams   - List all live streams');
  iina.console.log('[IPTV]   VOD Cats       - List VOD categories');
  iina.console.log('[IPTV]   VOD Streams    - List all VOD');
  iina.console.log('[IPTV]   Series Cats    - List series categories');
  iina.console.log('[IPTV]   Series Streams - List all series');
  iina.console.log('[IPTV]   Play by ID     - Play stream (enter ID)');
  iina.console.log('[IPTV] ========================================');
}

// ============================================================================
// Menu Registration
// ============================================================================

loadConfig();

try {
  if (typeof iina.menu !== 'undefined' && typeof iina.menu.item === 'function') {
    // Primary action - Open Browser Window
    iina.menu.addItem(iina.menu.item('IPTV: Open Browser', openBrowserWindow));
    
    // Configuration
    iina.menu.addItem(iina.menu.item('IPTV: Configure', actionConfigure));
    
    // Quick access (max 5 items total)
    iina.menu.addItem(iina.menu.item('IPTV: Live Categories', actionLiveCategories));
    iina.menu.addItem(iina.menu.item('IPTV: VOD Categories', actionVODCategories));
    iina.menu.addItem(iina.menu.item('IPTV: Help', actionHelp));
    
    iina.console.log('[IPTV Global] Menu registered (5 items)');
  } else {
    iina.console.error('[IPTV Global] iina.menu not available');
  }
} catch (e) {
  iina.console.error('[IPTV Global] Menu registration failed: ' + e.message);
}

iina.console.log('[IPTV Global] Initialization complete');
