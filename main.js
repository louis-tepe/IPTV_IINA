/**
 * IINA IPTV Plugin - Main Window Entry Point
 * Uses correct IINA 1.4.1 plugin patterns based on official OpenSubtitles plugin
 */

'use strict';

var sidebar = iina.sidebar;
var event = iina.event;
var core = iina.core;
var preferences = iina.preferences;
var http = iina.http;
var mpv = iina.mpv;

iina.console.log('[IPTV Main] Plugin main entry loaded');

// ============================================================================
// Configuration
// ============================================================================

var POSITION_SAVE_THRESHOLD = 5;
var POSITION_SAVE_THROTTLE = 5000;
var lastProcessedTimestamp = 0;
var currentStreamId = null;
var currentStreamType = null;
var lastSavedPosition = 0;
var lastSaveTime = 0;
var isTrackingPlayback = false;
var sidebarInitialized = false;

// ============================================================================
// Helper Functions
// ============================================================================

function getConfig() {
  try {
    var configStr = preferences.get('iptv_config');
    if (configStr) return JSON.parse(configStr);
  } catch (e) {
    iina.console.error('[IPTV Main] Error reading config: ' + e.message);
  }
  return null;
}

function buildStreamUrl(config, streamId, type) {
  var ext = type === 'live' ? 'ts' : 'm3u8';
  var streamType = type === 'live' ? 'live' : type === 'vod' ? 'movie' : 'series';
  return config.server + '/' + streamType + '/' + config.username + '/' + config.password + '/' + streamId + '.' + ext;
}

function sendToSidebar(type, data) {
  try {
    if (sidebar && typeof sidebar.postMessage === 'function') {
      sidebar.postMessage(type, data);
    }
  } catch (e) {
    iina.console.error('[IPTV Main] Error sending to sidebar: ' + e.message);
  }
}

// ============================================================================
// API Functions (WebView Proxy for ATS bypass)
// ============================================================================

// Pending API requests (routed through sidebar WebView to bypass ATS)
var pendingApiRequests = {};
var apiRequestIdCounter = 0;

function sidebarApiRequest(url, callback) {
  var requestId = 'sidebar_req_' + (++apiRequestIdCounter) + '_' + Date.now();
  pendingApiRequests[requestId] = callback;
  
  iina.console.log('[IPTV Main] API request via WebView proxy: ' + requestId);
  sendToSidebar('api_request', { requestId: requestId, url: url });
  
  // Timeout after 30 seconds
  setTimeout(function() {
    if (pendingApiRequests[requestId]) {
      iina.console.error('[IPTV Main] API request timeout: ' + requestId);
      delete pendingApiRequests[requestId];
      callback(new Error('Request timeout'));
    }
  }, 30000);
}

function handleApiResponse(data) {
  if (!data || !data.requestId) {
    iina.console.error('[IPTV Main] Invalid API response - no requestId');
    return;
  }
  
  var callback = pendingApiRequests[data.requestId];
  if (!callback) {
    iina.console.error('[IPTV Main] No callback for requestId: ' + data.requestId);
    return;
  }
  delete pendingApiRequests[data.requestId];
  
  if (!data.success) {
    iina.console.error('[IPTV Main] API error: ' + (data.error || 'Unknown'));
    callback(new Error(data.error || 'Network error'));
    return;
  }
  
  iina.console.log('[IPTV Main] API response received, status: ' + data.statusCode);
  
  try {
    var parsed = JSON.parse(data.text);
    callback(null, parsed);
  } catch (e) {
    iina.console.error('[IPTV Main] API parse error: ' + e.message);
    callback(new Error('Invalid JSON response'));
  }
}

function fetchCategories(type) {
  var config = getConfig();
  if (!config || !config.server) {
    sendToSidebar('error', { message: 'Server not configured' });
    return;
  }
  
  var action = 'get_' + type + '_categories';
  var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=' + action;
  
  iina.console.log('[IPTV Main] Fetching categories: ' + type);
  
  // Route through WebView proxy to bypass macOS ATS blocking HTTP
  sidebarApiRequest(url, function(err, data) {
    if (err) {
      iina.console.error('[IPTV Main] Failed to fetch categories: ' + err.message);
      sendToSidebar('error', { message: 'Failed to fetch categories' });
      return;
    }
    iina.console.log('[IPTV Main] Categories received: ' + (data.length || 0));
    sendToSidebar('categories', data);
  });
}

function fetchStreams(type, categoryId, categoryName) {
  var config = getConfig();
  if (!config || !config.server) {
    sendToSidebar('error', { message: 'Server not configured' });
    return;
  }
  
  var action = type === 'series' ? 'get_series' : 'get_' + type + '_streams';
  var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=' + action + '&category_id=' + categoryId;
  
  iina.console.log('[IPTV Main] Fetching streams: ' + type + ', category: ' + categoryId);
  
  // Route through WebView proxy to bypass macOS ATS blocking HTTP
  sidebarApiRequest(url, function(err, data) {
    if (err) {
      iina.console.error('[IPTV Main] Failed to fetch streams: ' + err.message);
      sendToSidebar('error', { message: 'Failed to fetch streams' });
      return;
    }
    iina.console.log('[IPTV Main] Streams received: ' + (data.length || 0));
    sendToSidebar('streams', { streams: data, categoryName: categoryName });
  });
}

// ============================================================================
// Playback Functions
// ============================================================================

function handlePlayRequest(data) {
  try {
    if (!data) {
      iina.console.error('[IPTV Main] Received empty play request');
      return;
    }
    
    if (data.timestamp && data.timestamp <= lastProcessedTimestamp) {
      iina.console.log('[IPTV Main] Duplicate play request ignored');
      return;
    }
    
    iina.console.log('[IPTV Main] Playing: ' + data.name);
    
    lastProcessedTimestamp = data.timestamp || Date.now();
    currentStreamId = data.streamId || data.id || null;
    currentStreamType = data.type || null;
    
    playStream(data.url, data.name, data.type, data.resumePosition);
  } catch (e) {
    iina.console.error('[IPTV Main] Error handling play request: ' + e.message);
  }
}

function playStream(url, name, type, resumePosition) {
  iina.console.log('[IPTV Main] Opening: ' + url);

  try {
    core.open(url);
    
    if (typeof core.osd === 'function') {
      core.osd('Playing: ' + name);
    }
    
    iina.console.log('[IPTV Main] ✓ Video opened');
    startPlaybackTracking(resumePosition);
  } catch (e) {
    iina.console.error('[IPTV Main] Error opening video: ' + e.message);
  }
}

function startPlaybackTracking(initialPosition) {
  if (initialPosition && initialPosition > 0) {
    setTimeout(function() {
      try {
        mpv.command('seek', [String(initialPosition), 'absolute']);
        iina.console.log('[IPTV Main] Resumed from: ' + initialPosition + 's');
        lastSavedPosition = initialPosition;
      } catch (e) {
        iina.console.error('[IPTV Main] Failed to seek: ' + e.message);
      }
    }, 500);
  }
  isTrackingPlayback = true;
}

function saveCurrentPosition(position) {
  if (!currentStreamId) return;

  var now = Date.now();
  if (now - lastSaveTime < POSITION_SAVE_THROTTLE) return;

  try {
    var pos = position;
    var duration = 0;

    if (pos === undefined) {
      pos = mpv.getNumber('time-pos') || 0;
      duration = mpv.getNumber('duration') || 0;
    }

    if (pos > 0 && Math.abs(pos - lastSavedPosition) > POSITION_SAVE_THRESHOLD) {
      var resumeData = {
        streamId: currentStreamId,
        type: currentStreamType,
        position: Math.floor(pos),
        duration: Math.floor(duration),
        updatedAt: now
      };

      preferences.set('iptv_current_resume', JSON.stringify(resumeData));
      lastSavedPosition = pos;
      lastSaveTime = now;
    }
  } catch (e) {
    iina.console.error('[IPTV Main] Error saving position: ' + e.message);
  }
}

function clearResumePosition() {
  if (currentStreamId) {
    try {
      preferences.set('iptv_current_resume', null);
    } catch (e) {}
  }
}

// ============================================================================
// Sidebar Message Handler
// ============================================================================

function handleSidebarMessage(name, data) {
  iina.console.log('[IPTV Main] Sidebar message: ' + name);
  
  switch (name) {
    case 'ready':
      // Sidebar is ready, send config status
      var config = getConfig();
      sendToSidebar('init', {
        configured: !!(config && config.server),
        server: config ? config.server : null
      });
      break;
      
    case 'getCategories':
      if (data && data.type) {
        fetchCategories(data.type);
      }
      break;
      
    case 'getStreams':
      if (data && data.type && data.categoryId) {
        fetchStreams(data.type, data.categoryId, data.categoryName);
      }
      break;
      
    case 'play':
      if (data) {
        var config = getConfig();
        if (config && config.server) {
          var url = buildStreamUrl(config, data.id, data.type);
          handlePlayRequest({
            url: url,
            name: data.name,
            type: data.type,
            streamId: data.id,
            timestamp: Date.now()
          });
        } else {
          sendToSidebar('error', { message: 'Server not configured' });
        }
      }
      break;
      
    case 'error':
      iina.console.error('[IPTV Main] Sidebar error: ' + JSON.stringify(data));
      break;
  }
}

// ============================================================================
// Initialize Sidebar (CORRECT PATTERN - inside window-loaded event)
// ============================================================================

event.on('iina.window-loaded', function() {
  iina.console.log('[IPTV Main] Window loaded - initializing sidebar');
  
  if (sidebarInitialized) {
    iina.console.log('[IPTV Main] Sidebar already initialized');
    return;
  }
  
  try {
    // Load sidebar HTML file - this is the CORRECT pattern
    sidebar.loadFile('ui/browser.html');
    iina.console.log('[IPTV Main] ✓ Sidebar HTML loaded: ui/browser.html');
    
    // Set up per-message handlers (IINA 1.4 API requires separate handlers)
    sidebar.onMessage('ready', function(data) {
      iina.console.log('[IPTV Main] Sidebar ready signal received');
      var config = getConfig();
      sendToSidebar('init', {
        configured: !!(config && config.server),
        server: config ? config.server : null
      });
    });
    
    sidebar.onMessage('getCategories', function(data) {
      iina.console.log('[IPTV Main] getCategories request: ' + (data ? data.type : 'unknown'));
      if (data && data.type) {
        fetchCategories(data.type);
      }
    });
    
    sidebar.onMessage('getStreams', function(data) {
      iina.console.log('[IPTV Main] getStreams request');
      if (data && data.type && data.categoryId) {
        fetchStreams(data.type, data.categoryId, data.categoryName);
      }
    });
    
    sidebar.onMessage('play', function(data) {
      iina.console.log('[IPTV Main] play request: ' + (data ? data.name : 'unknown'));
      if (data) {
        var config = getConfig();
        if (config && config.server) {
          var url = buildStreamUrl(config, data.id, data.type);
          handlePlayRequest({
            url: url,
            name: data.name,
            type: data.type,
            streamId: data.id,
            timestamp: Date.now()
          });
        } else {
          sendToSidebar('error', { message: 'Server not configured' });
        }
      }
    });
    
    sidebar.onMessage('api_response', function(data) {
      iina.console.log('[IPTV Main] API response received via sidebar');
      handleApiResponse(data);
    });
    
    sidebar.onMessage('error', function(data) {
      iina.console.error('[IPTV Main] Sidebar error: ' + JSON.stringify(data));
    });
    
    iina.console.log('[IPTV Main] ✓ Sidebar message handlers registered');
    
    sidebarInitialized = true;
  } catch (e) {
    iina.console.error('[IPTV Main] Failed to initialize sidebar: ' + e.message);
  }
});

// ============================================================================
// Event Handlers
// ============================================================================

event.on('iina.file-loaded', function() {
  iina.console.log('[IPTV Main] File loaded');
  isTrackingPlayback = false;
  startPlaybackTracking();
});

event.on('mpv.end-file', function() {
  iina.console.log('[IPTV Main] Playback ended');
  isTrackingPlayback = false;
  saveCurrentPosition();
  clearResumePosition();
  currentStreamId = null;
  currentStreamType = null;
  lastSavedPosition = 0;
  lastSaveTime = 0;
});

event.on('mpv.time-pos.changed', function(pos) {
  if (isTrackingPlayback && currentStreamId) {
    if (Math.abs(pos - lastSavedPosition) > POSITION_SAVE_THRESHOLD) {
      saveCurrentPosition(pos);
    }
  }
});

event.on('iina.window-will-close', function() {
  iina.console.log('[IPTV Main] Window will close');
  if (isTrackingPlayback && currentStreamId) {
    saveCurrentPosition();
  }
});

// ============================================================================
// Polling for requests from global.js
// ============================================================================

var lastCheckedTimestamp = 0;
var lastBrowserRequestTimestamp = 0;

function checkForPlayRequests() {
  try {
    var playRequestStr = preferences.get('iptv_play_request');
    if (playRequestStr) {
      var data = JSON.parse(playRequestStr);
      if (data.timestamp && data.timestamp > lastCheckedTimestamp) {
        lastCheckedTimestamp = data.timestamp;
        handlePlayRequest(data);
        preferences.set('iptv_play_request', null);
      }
    }
  } catch (e) { /* ignore */ }
}

function checkForBrowserRequests() {
  try {
    var browserRequestStr = preferences.get('iptv_browser_request');
    if (browserRequestStr) {
      var data = JSON.parse(browserRequestStr);
      if (data.timestamp && data.timestamp > lastBrowserRequestTimestamp) {
        lastBrowserRequestTimestamp = data.timestamp;
        iina.console.log('[IPTV Main] Browser request received, opening sidebar');
        
        // Open the sidebar
        if (sidebar && typeof sidebar.show === 'function') {
          sidebar.show();
          iina.console.log('[IPTV Main] Sidebar opened');
        }
        
        // Clear the request
        preferences.set('iptv_browser_request', null);
      }
    }
  } catch (e) { /* ignore */ }
}

setInterval(function() {
  checkForPlayRequests();
  checkForBrowserRequests();
}, 500);

iina.console.log('[IPTV Main] Initialization complete');

