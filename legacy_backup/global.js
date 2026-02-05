/**
 * IINA IPTV Plugin - Global Entry Point
 * v2.7.0-DEBUG-VISIBLE - Visible Debug Panel Version
 * 
 * Features: Live TV, VOD, Series, Favorites, History, EPG, Search, Smart Caching
 * @author IPTV Plugin Developer
 * @version 2.7.0-DEBUG-VISIBLE
 * 
 * DEBUG FEATURES:
 * - Visible debug panel always shown at bottom of browser
 * - All frontend logs displayed directly in UI
 * - All messages sent/received logged with color coding
 * - Connection status indicator in debug panel
 * - Message count and timestamp tracking
 */

'use strict';

// ============================================
// MODULES IMPORT (ES6)
// ============================================
// Note: IINA plugins use CommonJS-style require in the background
// The src/ modules are loaded and their functions made available

// ============================================
// CONSTANTS
// ============================================

/** @const {string} */
var LOG_PREFIX = '[IPTV]';

/** @const {string} */
var PLUGIN_VERSION = '5.5.0-COMPLETE-METADATA-FIX';

/** @const {number} */
var REQUEST_TIMEOUT = 30000; // 30 seconds

/** @const {number} */
var MAX_HISTORY_ITEMS = 50;

/** @const {number} */
var MAX_SEARCH_RESULTS = 50;

/** @const {number} */
var CACHE_TTL = 300000; // 5 minutes cache

// ============================================
// MESSAGE HANDLER STATE
// ============================================

/** @type {boolean} */
var messageHandlersSetup = false;

// ============================================
// DEBUG: CONFIRM GLOBAL.JS LOADING
// ============================================
iina.console.log('[IPTV] === global.js script loaded and executing ===');
iina.console.log('[IPTV] Plugin version: ' + PLUGIN_VERSION);
iina.console.log('[IPTV] Timestamp: ' + new Date().toISOString());

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================

/**
 * Global unhandled promise rejection handler
 * Catches any unhandled promise rejections and logs them
 */
if (typeof process !== 'undefined' && process.on) {
  process.on('unhandledRejection', function(reason, promise) {
    var errorMsg = 'Unhandled Promise Rejection: ' + (reason && reason.message ? reason.message : String(reason));
    logError('========================================');
    logError('UNHANDLED PROMISE REJECTION');
    logError('========================================');
    logError('Reason: ' + errorMsg);
    if (reason && reason.stack) {
      logError('Stack: ' + reason.stack);
    }
    logError('========================================');
    
    // Try to send error to frontend
    try {
      if (win && typeof win.postMessage === 'function') {
        win.postMessage('error', 'Internal error: ' + errorMsg);
      }
    } catch (e) {
      // Ignore if we can't send
    }
  });
  
  process.on('uncaughtException', function(error) {
    logError('========================================');
    logError('UNCAUGHT EXCEPTION');
    logError('========================================');
    logError('Error: ' + error.message);
    if (error.stack) {
      logError('Stack: ' + error.stack);
    }
    logError('========================================');
    
    // Try to send error to frontend
    try {
      if (win && typeof win.postMessage === 'function') {
        win.postMessage('error', 'Critical error: ' + error.message);
      }
    } catch (e) {
      // Ignore if we can't send
    }
  });
}

// ============================================
// RESUME POSITION SYNC FROM MAIN.JS
// ============================================

/**
 * Sync resume positions from main.js periodically
 * main.js saves current position to iptv_current_resume preference
 * This function reads it and updates our stored resume positions
 * Now uses file-based storage for persistence
 */
setInterval(async function() {
  try {
    var currentResumeStr = prefs.get('iptv_current_resume');
    if (currentResumeStr) {
      var currentResume = JSON.parse(currentResumeStr);
      if (currentResume && currentResume.streamId && currentResume.position > 0) {
        // Update the resume position in our storage
        state.resumePositions[String(currentResume.streamId)] = {
          position: currentResume.position,
          duration: currentResume.duration || 0,
          updatedAt: currentResume.updatedAt || Date.now()
        };
        // Save to persistent storage (file + preferences)
        await saveResumePositions();
      }
    }
  } catch (e) {
    // Silently ignore sync errors - this runs frequently
  }
}, 5000); // Check every 5 seconds (increased frequency for better accuracy)

log('✓ Resume position sync from main.js initialized (every 5s with file persistence)');

// ============================================
// STATE
// ============================================

/**
 * Global plugin state
 * @typedef {Object} PluginState
 * @property {XtreamAPI|null} api - API client instance
 * @property {boolean} isConnected - Connection status
 * @property {Object|null} credentials - User credentials
 * @property {Object} favorites - Favorites map by ID
 * @property {Array} history - Watch history
 * @property {Object} cache - Data cache with timestamps
 * @property {number|null} searchDebounceTimer - Search debounce timer
 */

/** @type {PluginState} */
var state = {
  api: null,
  isConnected: false,
  credentials: null,
  favorites: {},
  history: [],
  resumePositions: {}, // Issue 3: Track resume positions
  cache: {
    liveCategories: { data: null, timestamp: 0 },
    vodCategories: { data: null, timestamp: 0 },
    seriesCategories: { data: null, timestamp: 0 },
    streams: {} // Key: "type:categoryId"
  },
  searchDebounceTimer: null
};

// ============================================
// IINA MODULE ALIASES
// ============================================

var win = iina.standaloneWindow;
var prefs = iina.preferences;
var menu = iina.menu;
var http = iina.http;

// ============================================
// LOGGING SYSTEM
// ============================================

/**
 * Log an informational message
 * @param {string} msg - Message to log
 */
function log(msg) {
  var m = LOG_PREFIX + ' ' + msg;
  iina.console.log(m);
  if (win && typeof win.postMessage === 'function') {
    try {
      win.postMessage('log', m);
    } catch (e) {}
  }
}

/**
 * Log an error message
 * @param {string} msg - Error message to log
 */
function logError(msg) {
  var m = LOG_PREFIX + ' ERROR: ' + msg;
  iina.console.error(m);
  if (win && typeof win.postMessage === 'function') {
    try {
      win.postMessage('log', '❌ ' + m);
    } catch (e) {}
  }
}

/**
 * Log plugin startup
 */
log('=== Plugin v' + PLUGIN_VERSION + ' starting ===');

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Custom Base64 encode function for IINA environment
 * btoa() is not available in IINA's JavaScript context
 * @param {string} str - String to encode
 * @returns {string}
 */
function base64Encode(str) {
  if (!str) return '';
  try {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var encoded = '';
    var c1, c2, c3;
    var i = 0;
    
    while (i < str.length) {
      c1 = str.charCodeAt(i++);
      c2 = str.charCodeAt(i++);
      c3 = str.charCodeAt(i++);
      
      encoded += chars.charAt(c1 >> 2);
      encoded += chars.charAt(((c1 & 3) << 4) | (c2 >> 4));
      
      if (isNaN(c2)) {
        encoded += '==';
      } else {
        encoded += chars.charAt(((c2 & 15) << 2) | (c3 >> 6));
        encoded += isNaN(c3) ? '=' : chars.charAt(c3 & 63);
      }
    }
    
    return encoded;
  } catch (e) {
    logError('[Base64] Failed to encode: ' + e.message);
    return str; // Return original if encoding fails
  }
}

/**
 * Custom Base64 decode function for IINA environment
 * atob() is not available in IINA's JavaScript context
 * @param {string} str - String to decode
 * @returns {string}
 */
function base64Decode(str) {
  if (!str) return '';
  try {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var output = '';
    var i = 0;
    
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');
    
    while (i < str.length) {
      var enc1 = chars.indexOf(str.charAt(i++));
      var enc2 = chars.indexOf(str.charAt(i++));
      var enc3 = chars.indexOf(str.charAt(i++));
      var enc4 = chars.indexOf(str.charAt(i++));
      
      var chr1 = (enc1 << 2) | (enc2 >> 4);
      var chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      var chr3 = ((enc3 & 3) << 6) | enc4;
      
      output += String.fromCharCode(chr1);
      
      if (enc3 !== 64) {
        output += String.fromCharCode(chr2);
      }
      if (enc4 !== 64) {
        output += String.fromCharCode(chr3);
      }
    }
    
    return output;
  } catch (e) {
    logError('[Base64] Failed to decode: ' + e.message);
    return str; // Return original if decoding fails
  }
}

/**
 * Sleep/delay utility for retry backoff
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} context - Context for error message
 * @returns {Promise<any>}
 */
function withTimeout(promise, ms, context) {
  return new Promise(function(resolve, reject) {
    var timeoutId = setTimeout(function() {
      reject(new Error(context + ' timeout after ' + ms + 'ms'));
    }, ms);

    promise.then(function(result) {
      clearTimeout(timeoutId);
      resolve(result);
    }).catch(function(err) {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Check if cache is valid
 * @param {Object} cacheEntry - Cache entry with data and timestamp
 * @returns {boolean}
 */
function isCacheValid(cacheEntry) {
  if (!cacheEntry || !cacheEntry.data) {
    log('[Cache] MISS - No cache entry or data');
    return false;
  }
  var isValid = (Date.now() - cacheEntry.timestamp) < CACHE_TTL;
  if (isValid) {
    var age = Math.round((Date.now() - cacheEntry.timestamp) / 1000);
    log('[Cache] HIT - Data valid (age: ' + age + 's)');
  } else {
    var expired = Math.round((Date.now() - cacheEntry.timestamp) / 1000);
    log('[Cache] MISS - Cache expired (expired: ' + expired + 's ago)');
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

// ============================================
// XTREAM API CLASS
// ============================================

/**
 * Xtream Codes API Client
 * @constructor
 * @param {Object} creds - Credentials object
 * @param {string} creds.server - Server URL
 * @param {string} creds.username - Username
 * @param {string} creds.password - Password
 */
function XtreamAPI(creds) {
  this.server = creds.server.replace(/\/$/, '');
  this.username = creds.username;
  this.password = creds.password;
  this.activeRequest = null;
}

/**
 * Make an API request with retry logic
 * @param {string} action - API action
 * @param {Object} [params] - Query parameters
 * @param {number} [retries=2] - Number of retries
 * @returns {Promise<any>}
 */
XtreamAPI.prototype.request = function(action, params, retries) {
  retries = retries || 2;
  var self = this;
  
  // Cancel previous request
  if (this.activeRequest) {
    log('Cancelling previous request');
    this.activeRequest.cancelled = true;
  }

  var url = this.server + '/player_api.php?username=' + this.username + '&password=' + this.password;
  if (action) url += '&action=' + action;
  if (params) {
    for (var k in params) {
      url += '&' + k + '=' + encodeURIComponent(params[k]);
    }
  }

  var requestId = Date.now();
  this.activeRequest = { id: requestId, cancelled: false };
  var currentRequest = this.activeRequest;

  return new Promise(function(resolve, reject) {
    var attempt = 0;
    
    function tryRequest() {
      attempt++;
      log('API Request: ' + action + (attempt > 1 ? ' (retry ' + (attempt - 1) + ')' : ''));
      
      var stdoutChunks = [];
      var stderrChunks = [];
      var totalBytes = 0;
      var timeoutId = null;
      
      timeoutId = setTimeout(function() {
        if (!currentRequest.cancelled) {
          currentRequest.cancelled = true;
          self.activeRequest = null;
          if (attempt <= retries) {
            log('Request timeout, retrying... (' + attempt + '/' + retries + ')');
            currentRequest.cancelled = false;
            setTimeout(tryRequest, 1000 * attempt); // Exponential backoff
          } else {
            reject(new Error('Request timeout after ' + retries + ' retries'));
          }
        }
      }, REQUEST_TIMEOUT);

      // Check if iina.utils.exec is available
      if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') {
        clearTimeout(timeoutId);
        logError('iina.utils.exec is not available in this IINA version');
        reject(new Error('iina.utils.exec API not available - IINA version may be too old'));
        return;
      }
      
      iina.utils.exec('/usr/bin/curl', ['-s', '-L', '--no-keepalive', '--max-time', '30', url], null, 
        function(chunk) {
          if (currentRequest.cancelled) return;
          stdoutChunks.push(chunk);
          totalBytes += chunk.length;
        },
        function(chunk) {
          if (currentRequest.cancelled) return;
          stderrChunks.push(chunk);
        }
      ).then(function(result) {
        clearTimeout(timeoutId);
        
        if (currentRequest.cancelled) {
          return; // Silently ignore cancelled requests
        }

        self.activeRequest = null;

        if (result.status !== 0) {
          if (attempt <= retries) {
            log('Curl failed (status ' + result.status + '), retrying...');
            setTimeout(tryRequest, 1000 * attempt);
            return;
          }
          reject(new Error('Network error after ' + retries + ' retries'));
          return;
        }

        if (stdoutChunks.length === 0) {
          reject(new Error('Empty response from server'));
          return;
        }

        var fullString = stdoutChunks.join('');
        
        try {
          var data = JSON.parse(fullString);
          log('Response: ' + (Array.isArray(data) ? data.length + ' items' : 'object') + 
              ' (' + Math.round(totalBytes/1024) + ' KB)');
          resolve(data);
        } catch (e) {
          logError('JSON Parse Error: ' + e.message);
          reject(new Error('Invalid JSON response'));
        }
      }).catch(function(e) {
        clearTimeout(timeoutId);
        if (currentRequest.cancelled) return;
        
        if (attempt <= retries) {
          log('Request failed, retrying... (' + attempt + '/' + retries + ')');
          setTimeout(tryRequest, 1000 * attempt);
        } else {
          self.activeRequest = null;
          reject(e);
        }
      });
    }
    
    tryRequest();
  });
};

/**
 * Get stream URL
 * @param {string} id - Stream ID
 * @param {string} type - Stream type (live, vod, series)
 * @param {string} [ext] - File extension
 * @returns {string}
 */
XtreamAPI.prototype.getStreamUrl = function(id, type, ext) {
  ext = ext || 'ts';
  log('getStreamUrl: Building URL with id=' + id + ', type=' + type + ', ext=' + ext);
  log('getStreamUrl: API credentials - server=' + this.server + ', username=' + this.username);
  
  var finalUrl;
  
  // Pour les épisodes de séries, utiliser le format spécifique
  if (type === 'series') {
    finalUrl = this.getSeriesEpisodeUrl(id, ext);
  } else {
    // Format standard pour live et vod
    var baseUrl = this.server + '/' + type + '/' + this.username + '/' + this.password + '/' + id;
    finalUrl = baseUrl + '.' + ext;
  }
  
  log('getStreamUrl: Final URL = ' + finalUrl);
  return finalUrl;
};

/**
 * Get series episode stream URL
 * Format Xtream Codes API pour les épisodes: /series/username/password/{episode_id}.{ext}
 * Certains providers utilisent aussi: /streaming/stream.php?id={id}&type=series
 * 
 * @param {string} episodeId - Episode ID (généralement le champ 'id' de l'épisode)
 * @param {string} [ext] - File extension (mp4, mkv, etc.)
 * @returns {string}
 */
XtreamAPI.prototype.getSeriesEpisodeUrl = function(episodeId, ext) {
  ext = ext || 'mp4';
  log('getSeriesEpisodeUrl: Building URL for episode=' + episodeId + ', ext=' + ext);
  
  // Format standard Xtream Codes pour les épisodes de séries
  // L'ID de l'épisode est utilisé directement (pas le stream_id)
  var finalUrl = this.server + '/series/' + this.username + '/' + this.password + '/' + episodeId + '.' + ext;
  
  log('getSeriesEpisodeUrl: URL = ' + finalUrl);
  return finalUrl;
};

/**
 * Get EPG for a stream
 * @param {string} streamId - Stream ID
 * @returns {Promise<any>}
 */
XtreamAPI.prototype.getEpg = function(streamId) {
  return this.request('get_short_epg', { stream_id: streamId });
};

// ============================================
// STORAGE MANAGEMENT (Hybrid: fileSystem + preferences)
// ============================================

/**
 * Storage keys with plugin prefix to avoid conflicts
 */
var STORAGE_KEYS = {
  SERVER: 'iptv_server',
  USERNAME: 'iptv_username',
  PASSWORD: 'iptv_password',
  REMEMBER_ME: 'iptv_remember_me'
};

/**
 * Credentials file path (relative to plugin data directory)
 */
var CREDENTIALS_FILE = 'iptv_credentials.json';

/**
 * Base64 encode password for basic obfuscation
 * @param {string} password - Plain text password
 * @returns {string}
 */
function encodePassword(password) {
  if (!password) return '';
  try {
    return base64Encode(password);
  } catch (e) {
    logError('[Storage] Failed to encode password: ' + e.message);
    return password;
  }
}

/**
 * Base64 decode password
 * @param {string} encoded - Encoded password
 * @returns {string}
 */
function decodePassword(encoded) {
  if (!encoded) return '';
  try {
    return base64Decode(encoded);
  } catch (e) {
    // If decoding fails, return as-is (might be plain text from old version)
    return encoded;
  }
}

/**
 * Get the full path to the credentials file
 * Uses the plugin's directory in Application Support
 * @returns {string}
 */
function getCredentialsFilePath() {
  // Use the plugin's data directory
  var pluginDir = '/Users/tepe/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin';
  return pluginDir + '/' + CREDENTIALS_FILE;
}

/**
 * Write credentials to file using iina.utils.exec with shell commands
 * @param {Object} credentials - Credentials object
 * @returns {boolean}
 */
function writeCredentialsToFile(credentials) {
  return new Promise(function(resolve) {
    try {
      if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') {
        log('[Storage] iina.utils.exec not available, skipping file write');
        resolve(false);
        return;
      }
      
      var dataToSave = {
        server: credentials.server || '',
        username: credentials.username || '',
        password: encodePassword(credentials.password || ''),
        rememberMe: credentials.rememberMe || false,
        savedAt: new Date().toISOString(),
        version: '5.1.0'
      };
      
      var jsonData = JSON.stringify(dataToSave);
      var filePath = getCredentialsFilePath();
      
      // Ensure directory exists
      var mkdirCmd = '/bin/mkdir -p "' + filePath.substring(0, filePath.lastIndexOf('/')) + '"';
      
      // Write file using printf (handles special characters better than echo)
      var writeCmd = '/usr/bin/printf "%s" \'' + jsonData.replace(/'/g, "'\"'\"'") + '\' > "' + filePath + '"';
      
      // Execute mkdir first
      iina.utils.exec('/bin/sh', ['-c', mkdirCmd], null, function() {}, function() {}).then(function() {
        // Then write the file
        return iina.utils.exec('/bin/sh', ['-c', writeCmd], null, function() {}, function() {});
      }).then(function(result) {
        if (result && result.status === 0) {
          log('[Storage] ✓ Credentials written to file: ' + filePath);
          resolve(true);
        } else {
          logError('[Storage] Failed to write credentials file, status: ' + (result ? result.status : 'unknown'));
          resolve(false);
        }
      }).catch(function(e) {
        logError('[Storage] Error writing credentials file: ' + e.message);
        resolve(false);
      });
    } catch (e) {
      logError('[Storage] Failed to write credentials to file: ' + e.message);
      resolve(false);
    }
  });
}

/**
 * Read credentials from file using iina.utils.exec with shell commands
 * @returns {Promise<Object|null>}
 */
function readCredentialsFromFile() {
  return new Promise(function(resolve) {
    try {
      if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') {
        log('[Storage] iina.utils.exec not available, skipping file read');
        resolve(null);
        return;
      }
      
      var filePath = getCredentialsFilePath();
      var stdoutChunks = [];
      
      iina.utils.exec('/bin/cat', [filePath], null, 
        function(chunk) {
          stdoutChunks.push(chunk);
        },
        function(chunk) {
          // stderr
        }
      ).then(function(result) {
        if (result && result.status === 0 && stdoutChunks.length > 0) {
          var jsonData = stdoutChunks.join('');
          
          if (!jsonData || jsonData.trim() === '') {
            log('[Storage] Credentials file is empty');
            resolve(null);
            return;
          }
          
          try {
            var data = JSON.parse(jsonData);
            
            log('[Storage] ✓ Credentials loaded from file');
            log('[Storage]   - Server: ' + (data.server || 'none'));
            log('[Storage]   - Username: ' + (data.username || 'none'));
            log('[Storage]   - Remember Me: ' + (data.rememberMe ? 'YES' : 'NO'));
            
            resolve({
              server: data.server || '',
              username: data.username || '',
              password: decodePassword(data.password || ''),
              rememberMe: data.rememberMe === true
            });
          } catch (parseErr) {
            logError('[Storage] Failed to parse credentials file: ' + parseErr.message);
            resolve(null);
          }
        } else {
          log('[Storage] No credentials file found or file is empty');
          resolve(null);
        }
      }).catch(function(e) {
        log('[Storage] No credentials file found (file may not exist yet)');
        resolve(null);
      });
    } catch (e) {
      logError('[Storage] Failed to read credentials from file: ' + e.message);
      resolve(null);
    }
  });
}

/**
 * Delete credentials file using iina.utils.exec
 * @returns {Promise<boolean>}
 */
function deleteCredentialsFile() {
  return new Promise(function(resolve) {
    try {
      if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') {
        resolve(false);
        return;
      }
      
      var filePath = getCredentialsFilePath();
      
      iina.utils.exec('/bin/rm', ['-f', filePath], null, function() {}, function() {}).then(function(result) {
        log('[Storage] ✓ Credentials file deleted');
        resolve(true);
      }).catch(function(e) {
        logError('[Storage] Failed to delete credentials file: ' + e.message);
        resolve(false);
      });
    } catch (e) {
      logError('[Storage] Failed to delete credentials file: ' + e.message);
      resolve(false);
    }
  });
}

/**
 * Load credentials from storage with multi-tier fallback
 * Priority: File > Preferences (new) > Preferences (old)
 * Note: This function is now async to support file-based storage
 * @returns {Promise<Object>}
 */
async function loadCredentials() {
  log('[Storage] ========================================');
  log('[Storage] Loading credentials...');
  log('[Storage] ========================================');
  
  try {
    // Tier 1: Try file system first (most reliable)
    var fileCredentials = await readCredentialsFromFile();
    if (fileCredentials && (fileCredentials.server || fileCredentials.username)) {
      log('[Storage] ✓✓✓ Credentials loaded from FILE (primary source)');
      
      // Also save to preferences for redundancy
      try {
        prefs.set(STORAGE_KEYS.SERVER, fileCredentials.server || '');
        prefs.set(STORAGE_KEYS.USERNAME, fileCredentials.username || '');
        prefs.set(STORAGE_KEYS.PASSWORD, encodePassword(fileCredentials.password || ''));
        prefs.set(STORAGE_KEYS.REMEMBER_ME, fileCredentials.rememberMe ? 'true' : 'false');
        log('[Storage] ✓ Also synced to preferences for redundancy');
      } catch (syncErr) {
        log('[Storage] Note: Could not sync to preferences (non-critical): ' + syncErr.message);
      }
      
      return fileCredentials;
    }
    
    // Tier 2: Try new prefixed preferences keys
    log('[Storage] No file credentials found, trying preferences...');
    var server = prefs.get(STORAGE_KEYS.SERVER);
    var username = prefs.get(STORAGE_KEYS.USERNAME);
    var encodedPassword = prefs.get(STORAGE_KEYS.PASSWORD);
    var rememberMe = prefs.get(STORAGE_KEYS.REMEMBER_ME);
    
    if (server || username) {
      log('[Storage] ✓ Credentials found in preferences (new keys)');
      
      var prefCredentials = {
        server: server || '',
        username: username || '',
        password: decodePassword(encodedPassword || ''),
        rememberMe: rememberMe === 'true'
      };
      
      // Migrate to file system for better persistence
      log('[Storage] Migrating credentials from preferences to file system...');
      writeCredentialsToFile(prefCredentials); // Fire and forget
      
      return prefCredentials;
    }
    
    // Tier 3: Try old non-prefixed keys for migration
    log('[Storage] No new preference keys found, trying old keys for migration...');
    var oldServer = prefs.get('server');
    var oldUsername = prefs.get('username');
    var oldPassword = prefs.get('password');
    
    if (oldServer || oldUsername) {
      log('[Storage] ✓ Old credentials found, migrating to new format...');
      
      var migratedCredentials = {
        server: oldServer || '',
        username: oldUsername || '',
        password: oldPassword || '',
        rememberMe: true
      };
      
      // Save to both file and new preferences
      writeCredentialsToFile(migratedCredentials); // Fire and forget
      prefs.set(STORAGE_KEYS.SERVER, migratedCredentials.server || '');
      prefs.set(STORAGE_KEYS.USERNAME, migratedCredentials.username || '');
      prefs.set(STORAGE_KEYS.PASSWORD, encodePassword(migratedCredentials.password || ''));
      prefs.set(STORAGE_KEYS.REMEMBER_ME, 'true');
      
      // Clear old keys
      prefs.set('server', '');
      prefs.set('username', '');
      prefs.set('password', '');
      
      log('[Storage] ✓ Migration complete - old credentials saved in new format');
      
      return migratedCredentials;
    }
    
    // No credentials found anywhere
    log('[Storage] ✗ No saved credentials found in any storage');
    log('[Storage] ========================================');
    return { server: '', username: '', password: '', rememberMe: false };
    
  } catch (e) {
    logError('[Storage] Failed to load credentials: ' + e.message);
    logError('[Storage] Stack: ' + (e.stack || 'no stack'));
    log('[Storage] ========================================');
    return { server: '', username: '', password: '', rememberMe: false };
  }
}

/**
 * Save credentials to storage (hybrid: file + preferences)
 * Note: This function is now async to support file-based storage
 * @param {Object} c - Credentials object
 * @param {boolean} shouldRemember - Whether to save credentials
 * @returns {Promise<boolean>}
 */
async function saveCredentials(c, shouldRemember) {
  log('[Storage] ========================================');
  log('[Storage] Saving credentials...');
  log('[Storage] Remember Me: ' + (shouldRemember ? 'YES' : 'NO'));
  log('[Storage] ========================================');
  
  try {
    if (shouldRemember) {
      var credentialsToSave = {
        server: c.server || '',
        username: c.username || '',
        password: c.password || '',
        rememberMe: true
      };
      
      // Save to file system (primary storage) - async
      var fileSaved = await writeCredentialsToFile(credentialsToSave);
      
      // Also save to preferences (redundancy) - sync
      try {
        prefs.set(STORAGE_KEYS.SERVER, credentialsToSave.server || '');
        prefs.set(STORAGE_KEYS.USERNAME, credentialsToSave.username || '');
        prefs.set(STORAGE_KEYS.PASSWORD, encodePassword(credentialsToSave.password || ''));
        prefs.set(STORAGE_KEYS.REMEMBER_ME, 'true');
        log('[Storage] ✓ Credentials saved to preferences (redundancy)');
      } catch (prefErr) {
        log('[Storage] Warning: Could not save to preferences: ' + prefErr.message);
      }
      
      if (fileSaved) {
        log('[Storage] ✓✓✅ Credentials saved successfully (primary: file)');
        log('[Storage] ========================================');
        return true;
      } else {
        logError('[Storage] ⚠️ File save failed, but preferences may have succeeded');
        log('[Storage] ========================================');
        return true; // Still return true if preferences worked
      }
    } else {
      // Clear credentials if remember me is not checked
      log('[Storage] Clearing credentials (remember me disabled)...');
      
      await deleteCredentialsFile();
      
      try {
        prefs.set(STORAGE_KEYS.SERVER, '');
        prefs.set(STORAGE_KEYS.USERNAME, '');
        prefs.set(STORAGE_KEYS.PASSWORD, '');
        prefs.set(STORAGE_KEYS.REMEMBER_ME, 'false');
        log('[Storage] ✓ Credentials cleared from preferences');
      } catch (prefErr) {
        log('[Storage] Warning: Could not clear preferences: ' + prefErr.message);
      }
      
      log('[Storage] ✓ Credentials cleared (remember me disabled)');
      log('[Storage] ========================================');
      return true;
    }
  } catch (e) {
    logError('[Storage] Failed to save credentials: ' + e.message);
    logError('[Storage] Stack: ' + (e.stack || 'no stack'));
    log('[Storage] ========================================');
    return false;
  }
}

/**
 * Clear all credentials from storage (for logout)
 * Note: This function is now async to support file-based storage
 * @returns {Promise<boolean>}
 */
async function clearCredentials() {
  log('[Storage] ========================================');
  log('[Storage] Clearing all credentials (logout)...');
  log('[Storage] ========================================');
  
  try {
    // Clear file
    await deleteCredentialsFile();
    
    // Clear preferences
    prefs.set(STORAGE_KEYS.SERVER, '');
    prefs.set(STORAGE_KEYS.USERNAME, '');
    prefs.set(STORAGE_KEYS.PASSWORD, '');
    prefs.set(STORAGE_KEYS.REMEMBER_ME, 'false');
    
    log('[Storage] ✓✓✅ All credentials cleared');
    log('[Storage] ========================================');
    return true;
  } catch (e) {
    logError('[Storage] Failed to clear credentials: ' + e.message);
    log('[Storage] ========================================');
    return false;
  }
}

/**
 * Get the full path to the history file
 * Uses the plugin's data directory
 * @returns {string}
 */
function getHistoryFilePath() {
  // Use the plugin's data directory
  var pluginDir = '/Users/tepe/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin';
  return pluginDir + '/iptv_history.json';
}

/**
 * Get the full path to the resume positions file
 * Uses the plugin's data directory
 * @returns {string}
 */
function getResumePositionsFilePath() {
  // Use the plugin's data directory
  var pluginDir = '/Users/tepe/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin';
  return pluginDir + '/iptv_resume_positions.json';
}

/**
 * Write history to file using iina.utils.exec with shell commands
 * @param {Array} history - History array
 * @returns {Promise<boolean>}
 */
function writeHistoryToFile(history) {
  return new Promise(function(resolve) {
    try {
      if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') {
        log('[Storage] iina.utils.exec not available, skipping history file write');
        resolve(false);
        return;
      }
      
      var dataToSave = {
        history: history || [],
        savedAt: new Date().toISOString(),
        version: '6.2.0'
      };
      
      var jsonData = JSON.stringify(dataToSave);
      var filePath = getHistoryFilePath();
      
      // Ensure directory exists
      var mkdirCmd = '/bin/mkdir -p "' + filePath.substring(0, filePath.lastIndexOf('/')) + '"';
      
      // Write file using printf
      var writeCmd = '/usr/bin/printf "%s" \'' + jsonData.replace(/'/g, "'\"'\"'") + '\' > "' + filePath + '"';
      
      // Execute mkdir first
      iina.utils.exec('/bin/sh', ['-c', mkdirCmd], null, function() {}, function() {}).then(function() {
        // Then write the file
        return iina.utils.exec('/bin/sh', ['-c', writeCmd], null, function() {}, function() {});
      }).then(function(result) {
        if (result && result.status === 0) {
          log('[Storage] ✓ History written to file: ' + filePath);
          log('[Storage]   Items saved: ' + (history ? history.length : 0));
          resolve(true);
        } else {
          logError('[Storage] Failed to write history file, status: ' + (result ? result.status : 'unknown'));
          resolve(false);
        }
      }).catch(function(e) {
        logError('[Storage] Error writing history file: ' + e.message);
        resolve(false);
      });
    } catch (e) {
      logError('[Storage] Failed to write history to file: ' + e.message);
      resolve(false);
    }
  });
}

/**
 * Read history from file using iina.utils.exec with shell commands
 * @returns {Promise<Array|null>}
 */
function readHistoryFromFile() {
  return new Promise(function(resolve) {
    try {
      if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') {
        log('[Storage] iina.utils.exec not available, skipping history file read');
        resolve(null);
        return;
      }
      
      var filePath = getHistoryFilePath();
      var stdoutChunks = [];
      
      iina.utils.exec('/bin/cat', [filePath], null, 
        function(chunk) {
          stdoutChunks.push(chunk);
        },
        function(chunk) {
          // stderr
        }
      ).then(function(result) {
        if (result && result.status === 0 && stdoutChunks.length > 0) {
          var jsonData = stdoutChunks.join('');
          
          if (!jsonData || jsonData.trim() === '') {
            log('[Storage] History file is empty');
            resolve(null);
            return;
          }
          
          try {
            var data = JSON.parse(jsonData);
            
            log('[Storage] ✓ History loaded from file');
            log('[Storage]   Items loaded: ' + (data.history ? data.history.length : 0));
            
            resolve(data.history || []);
          } catch (parseErr) {
            logError('[Storage] Failed to parse history file: ' + parseErr.message);
            resolve(null);
          }
        } else {
          log('[Storage] No history file found (file may not exist yet)');
          resolve(null);
        }
      }).catch(function(e) {
        log('[Storage] No history file found: ' + e.message);
        resolve(null);
      });
    } catch (e) {
      logError('[Storage] Failed to read history from file: ' + e.message);
      resolve(null);
    }
  });
}

/**
 * Write resume positions to file using iina.utils.exec with shell commands
 * @param {Object} resumePositions - Resume positions object
 * @returns {Promise<boolean>}
 */
function writeResumePositionsToFile(resumePositions) {
  return new Promise(function(resolve) {
    try {
      if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') {
        log('[Storage] iina.utils.exec not available, skipping resume positions file write');
        resolve(false);
        return;
      }
      
      var dataToSave = {
        resumePositions: resumePositions || {},
        savedAt: new Date().toISOString(),
        version: '6.2.0'
      };
      
      var jsonData = JSON.stringify(dataToSave);
      var filePath = getResumePositionsFilePath();
      
      // Ensure directory exists
      var mkdirCmd = '/bin/mkdir -p "' + filePath.substring(0, filePath.lastIndexOf('/')) + '"';
      
      // Write file using printf
      var writeCmd = '/usr/bin/printf "%s" \'' + jsonData.replace(/'/g, "'\"'\"'") + '\' > "' + filePath + '"';
      
      // Execute mkdir first
      iina.utils.exec('/bin/sh', ['-c', mkdirCmd], null, function() {}, function() {}).then(function() {
        // Then write the file
        return iina.utils.exec('/bin/sh', ['-c', writeCmd], null, function() {}, function() {});
      }).then(function(result) {
        if (result && result.status === 0) {
          log('[Storage] ✓ Resume positions written to file: ' + filePath);
          log('[Storage]   Positions saved: ' + Object.keys(resumePositions || {}).length);
          resolve(true);
        } else {
          logError('[Storage] Failed to write resume positions file, status: ' + (result ? result.status : 'unknown'));
          resolve(false);
        }
      }).catch(function(e) {
        logError('[Storage] Error writing resume positions file: ' + e.message);
        resolve(false);
      });
    } catch (e) {
      logError('[Storage] Failed to write resume positions to file: ' + e.message);
      resolve(false);
    }
  });
}

/**
 * Read resume positions from file using iina.utils.exec with shell commands
 * @returns {Promise<Object|null>}
 */
function readResumePositionsFromFile() {
  return new Promise(function(resolve) {
    try {
      if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') {
        log('[Storage] iina.utils.exec not available, skipping resume positions file read');
        resolve(null);
        return;
      }
      
      var filePath = getResumePositionsFilePath();
      var stdoutChunks = [];
      
      iina.utils.exec('/bin/cat', [filePath], null, 
        function(chunk) {
          stdoutChunks.push(chunk);
        },
        function(chunk) {
          // stderr
        }
      ).then(function(result) {
        if (result && result.status === 0 && stdoutChunks.length > 0) {
          var jsonData = stdoutChunks.join('');
          
          if (!jsonData || jsonData.trim() === '') {
            log('[Storage] Resume positions file is empty');
            resolve(null);
            return;
          }
          
          try {
            var data = JSON.parse(jsonData);
            
            log('[Storage] ✓ Resume positions loaded from file');
            log('[Storage]   Positions loaded: ' + Object.keys(data.resumePositions || {}).length);
            
            resolve(data.resumePositions || {});
          } catch (parseErr) {
            logError('[Storage] Failed to parse resume positions file: ' + parseErr.message);
            resolve(null);
          }
        } else {
          log('[Storage] No resume positions file found (file may not exist yet)');
          resolve(null);
        }
      }).catch(function(e) {
        log('[Storage] No resume positions file found: ' + e.message);
        resolve(null);
      });
    } catch (e) {
      logError('[Storage] Failed to read resume positions from file: ' + e.message);
      resolve(null);
    }
  });
}

/**
 * Load favorites from storage
 */
function loadFavorites() {
  log('[Storage] Loading favorites...');
  try {
    var d = prefs.get('iptv_favorites');
    if (d) {
      state.favorites = JSON.parse(d);
      var count = Object.keys(state.favorites).length;
      log('[Storage] ✓ Loaded ' + count + ' favorites');
    } else {
      log('[Storage] No favorites found in storage');
    }
  } catch (e) {
    logError('[Storage] Failed to load favorites: ' + e.message);
    state.favorites = {};
  }
}

/**
 * Save favorites to storage
 */
function saveFavorites() {
  try {
    var count = Object.keys(state.favorites).length;
    prefs.set('iptv_favorites', JSON.stringify(state.favorites));
    log('[Storage] ✓ Saved ' + count + ' favorites');
  } catch (e) {
    logError('[Storage] Failed to save favorites: ' + e.message);
  }
}

/**
 * Load history from storage (file-based with preferences fallback)
 * Now async to support file-based storage
 */
async function loadHistory() {
  log('[Storage] ========================================');
  log('[Storage] Loading history...');
  log('[Storage] ========================================');
  
  try {
    // Tier 1: Try file system first (most reliable)
    var fileHistory = await readHistoryFromFile();
    if (fileHistory && Array.isArray(fileHistory)) {
      state.history = fileHistory;
      log('[Storage] ✓✓✓ History loaded from FILE (primary source)');
      log('[Storage]   Items: ' + state.history.length);
      
      // Also save to preferences for redundancy
      try {
        prefs.set('iptv_history', JSON.stringify(state.history));
        log('[Storage] ✓ Also synced to preferences for redundancy');
      } catch (syncErr) {
        log('[Storage] Note: Could not sync to preferences (non-critical): ' + syncErr.message);
      }
      
      log('[Storage] ========================================');
      return;
    }
    
    // Tier 2: Try preferences as fallback
    log('[Storage] No file history found, trying preferences...');
    var d = prefs.get('iptv_history');
    if (d && typeof d === 'string') {
      state.history = JSON.parse(d);
      log('[Storage] ✓ History loaded from preferences (fallback)');
      log('[Storage]   Items: ' + state.history.length);
      
      // Migrate to file system for better persistence
      log('[Storage] Migrating history from preferences to file system...');
      writeHistoryToFile(state.history); // Fire and forget
      
      log('[Storage] ========================================');
      return;
    } else if (d && typeof d === 'object') {
      state.history = d;
      log('[Storage] ✓ History loaded from preferences (already parsed, fallback)');
      log('[Storage]   Items: ' + state.history.length);
      
      // Migrate to file system
      writeHistoryToFile(state.history);
      
      log('[Storage] ========================================');
      return;
    }
    
    // Tier 3: No history found anywhere
    state.history = [];
    log('[Storage] ✗ No saved history found in any storage');
    log('[Storage] ========================================');
  } catch (e) {
    logError('[Storage] Failed to load history: ' + e.message);
    logError('[Storage] Stack: ' + (e.stack || 'no stack'));
    state.history = [];
    log('[Storage] ========================================');
  }
  
  // Issue 2 & 3: Load resume positions (file-based with fallback)
  try {
    log('[Storage] Loading resume positions...');
    
    // Tier 1: Try file system first
    var fileResumePositions = await readResumePositionsFromFile();
    if (fileResumePositions && typeof fileResumePositions === 'object') {
      state.resumePositions = fileResumePositions;
      log('[Storage] ✓✓✓ Resume positions loaded from FILE (primary source)');
      log('[Storage]   Positions: ' + Object.keys(state.resumePositions).length);
      
      // Also save to preferences for redundancy
      try {
        prefs.set('iptv_resume_positions', JSON.stringify(state.resumePositions));
        log('[Storage] ✓ Also synced to preferences for redundancy');
      } catch (syncErr) {
        log('[Storage] Note: Could not sync to preferences (non-critical): ' + syncErr.message);
      }
      
      log('[Storage] ========================================');
      return;
    }
    
    // Tier 2: Try preferences as fallback
    log('[Storage] No file resume positions found, trying preferences...');
    var rd = prefs.get('iptv_resume_positions');
    if (rd && typeof rd === 'string') {
      state.resumePositions = JSON.parse(rd);
      log('[Storage] ✓ Resume positions loaded from preferences (fallback)');
      log('[Storage]   Positions: ' + Object.keys(state.resumePositions).length);
      
      // Migrate to file system
      log('[Storage] Migrating resume positions from preferences to file system...');
      writeResumePositionsToFile(state.resumePositions); // Fire and forget
      
      log('[Storage] ========================================');
      return;
    } else if (rd && typeof rd === 'object') {
      state.resumePositions = rd;
      log('[Storage] ✓ Resume positions loaded from preferences (already parsed, fallback)');
      log('[Storage]   Positions: ' + Object.keys(state.resumePositions).length);
      
      // Migrate to file system
      writeResumePositionsToFile(state.resumePositions);
      
      log('[Storage] ========================================');
      return;
    }
    
    // Tier 3: No resume positions found
    state.resumePositions = {};
    log('[Storage] ✗ No saved resume positions found in any storage');
    log('[Storage] ========================================');
  } catch (e) {
    logError('[Storage] Failed to load resume positions: ' + e.message);
    state.resumePositions = {};
    log('[Storage] ========================================');
  }
}

/**
 * Save history to storage (file-based with preferences backup)
 * Now async to support file-based storage
 */
async function saveHistory() {
  log('[Storage] Saving history...');
  try {
    // Save to file system (primary storage) - async
    var fileSaved = await writeHistoryToFile(state.history);
    
    // Also save to preferences (redundancy) - sync
    try {
      var historyJson = JSON.stringify(state.history);
      prefs.set('iptv_history', historyJson);
      log('[Storage] ✓ History saved to preferences (redundancy)');
    } catch (prefErr) {
      log('[Storage] Warning: Could not save to preferences: ' + prefErr.message);
    }
    
    if (fileSaved) {
      log('[Storage] ✓✓✅ History saved successfully (primary: file)');
      log('[Storage]   Items: ' + state.history.length);
    } else {
      log('[Storage] ⚠️ File save failed, but preferences may have succeeded');
    }
  } catch (e) {
    logError('[Storage] Failed to save history: ' + e.message);
  }
}

/**
 * Issue 2 & 3: Save resume positions to storage (file-based with preferences backup)
 * Now async to support file-based storage
 */
async function saveResumePositions() {
  log('[Storage] Saving resume positions...');
  try {
    // Save to file system (primary storage) - async
    var fileSaved = await writeResumePositionsToFile(state.resumePositions);
    
    // Also save to preferences (redundancy) - sync
    try {
      var positionsJson = JSON.stringify(state.resumePositions);
      prefs.set('iptv_resume_positions', positionsJson);
      log('[Storage] ✓ Resume positions saved to preferences (redundancy)');
    } catch (prefErr) {
      log('[Storage] Warning: Could not save to preferences: ' + prefErr.message);
    }
    
    if (fileSaved) {
      log('[Storage] ✓✓✅ Resume positions saved successfully (primary: file)');
      log('[Storage]   Positions: ' + Object.keys(state.resumePositions).length);
    } else {
      log('[Storage] ⚠️ File save failed, but preferences may have succeeded');
    }
  } catch (e) {
    logError('[Storage] Failed to save resume positions: ' + e.message);
  }
}

/**
 * Issue 2: Enhanced history add with thumbnails and metadata
 * Now stores series_id separately for episodes to enable proper history click handling
 * FIXED: Uses correct unique key to avoid duplicate entries for same series
 */
async function addToHistory(item) {
  // CRITICAL FIX: Determine the unique key based on content type
  // For series episodes, use series_id to group episodes from same series
  // For live/vod, use stream_id
  var uniqueKey = item.series_id || item.stream_id || item.id;
  
  log('[History] Adding to history:');
  log('  name: ' + (item.name || 'Unknown'));
  log('  type: ' + (item.type || 'unknown'));
  log('  uniqueKey: ' + uniqueKey);
  if (item.series_id) {
    log('  series_id: ' + item.series_id + ' (using as unique key for grouping)');
  }
  
  // Remove existing entry with the same unique key
  state.history = state.history.filter(function(h) {
    var existingKey = h.series_id || h.stream_id || h.id;
    return existingKey !== uniqueKey;
  });
  
  // Build history entry with enhanced metadata
  var historyEntry = {
    id: item.id || item.stream_id || uniqueKey,
    name: item.name || 'Unknown',
    type: item.type || 'unknown',
    playedAt: Date.now(),
    // Issue 2: Add thumbnail and metadata for enhanced display
    thumbnail: item.thumbnail || item.stream_icon || item.cover || '',
    container_extension: item.container_extension || '',
    rating: item.rating || '',
    plot: item.plot || ''
  };
  
  // CRITICAL FIX: If this is an episode with a series_id, store it separately
  // This allows us to load the series info when clicking from history
  // AND ensures episodes from same series don't create duplicate history entries
  if (item.series_id) {
    historyEntry.series_id = item.series_id;
    log('[History] Storing episode with series_id: ' + item.series_id + ' (will group episodes)');
  }
  
  // Add to beginning
  state.history.unshift(historyEntry);
  
  // Trim to max items
  if (state.history.length > MAX_HISTORY_ITEMS) {
    state.history = state.history.slice(0, MAX_HISTORY_ITEMS);
  }
  
  await saveHistory();
  log('✓ Added to history: ' + item.name + ' (total: ' + state.history.length + ')');
}

/**
 * Issue 3: Update resume position for a stream
 * Now async to support file-based storage
 */
async function updateResumePosition(streamId, position, duration) {
  if (!streamId) return;
  
  state.resumePositions[String(streamId)] = {
    position: position,
    duration: duration,
    updatedAt: Date.now()
  };
  
  await saveResumePositions();
  log('[Resume] Saved position for ' + streamId + ': ' + position + 's / ' + duration + 's');
}

/**
 * Issue 3: Get resume position for a stream
 */
function getResumePosition(streamId) {
  var data = state.resumePositions[String(streamId)];
  if (data) {
    log('[Resume] Found position for ' + streamId + ': ' + data.position + 's');
    return data;
  }
  return null;
}

/**
 * Save cache to storage (persistent across sessions)
 */
function saveCache() {
  try {
    prefs.set('iptv_cache', JSON.stringify(state.cache));
  } catch (e) {}
}

/**
 * Load cache from storage
 */
function loadCache() {
  try {
    var d = prefs.get('iptv_cache');
    if (d) {
      var cached = JSON.parse(d);
      // Only restore if not too old
      if (cached && Date.now() - cached.timestamp < CACHE_TTL * 2) {
        state.cache = cached.data || state.cache;
        log('Restored cache from storage');
      }
    }
  } catch (e) {}
}

// ============================================
// WINDOW MANAGEMENT
// ============================================

/**
 * Show connection window
 */
async function showWindow() {
  log('=== showWindow called ===');
  
  loadFavorites();
  await loadHistory(); // Now async - wait for file-based storage
  loadCache();

  win.loadFile('connection.html');
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
    win.postMessage('init', creds);
    
    // Auto-reconnect only if rememberMe was enabled and credentials exist
    if (creds.rememberMe && creds.server && creds.username && creds.password) {
      log('Valid credentials found with rememberMe=true, attempting auto-connect...');
      win.postMessage('autoConnect', creds);
    } else if (!creds.rememberMe) {
      log('Remember me is disabled, skipping auto-connect');
    } else {
      log('No saved credentials found, manual entry required');
    }
  }, 500);
}

/**
 * Show browser page after connection
 */
function showBrowserPage() {
  log('=== showBrowserPage START ===');
  log('Loading browser.html');
  
  log('Loading browser.html file...');
  win.loadFile('browser.html');
  log('browser.html load requested');
  
  // CRITICAL FIX: Setup message handlers AFTER page loads
  // This ensures handlers are registered in the correct page context
  // and remain active for all subsequent messages
  setTimeout(function() {
    log('========================================');
    log('RE-REGISTERING message handlers after page load');
    log('========================================');
    
    // Reset the flag to allow re-registration
    messageHandlersSetup = false;
    
    // Setup handlers in the new page context
    setupMessageHandlers();
    
    log('========================================');
    log('Message handlers re-registered successfully');
    log('========================================');
    
    // Now send initial data
    log('Sending initial data to frontend...');
    try {
      win.postMessage('serverInfo', {
        name: state.credentials ? state.credentials.server : 'IPTV',
        version: PLUGIN_VERSION
      });
      log('serverInfo sent');
      
      win.postMessage('favorites', state.favorites);
      log('favorites sent');
      
      // Load live categories first
      log('Loading live categories...');
      loadCategories('live');
    } catch (e) {
      logError('Error sending initial data: ' + e.message);
    }
  }, 200);
  
  log('=== showBrowserPage END ===');
}

// ============================================
// MESSAGE HANDLERS
// ============================================

/**
 * Setup message handlers for UI communication
 */
function setupMessageHandlers() {
  // Prevent duplicate handler registration
  if (messageHandlersSetup) {
    log('setupMessageHandlers: Already called, skipping duplicate registration');
    return;
  }
  
  log('========================================');
  log('Setting up message handlers (v2.5.3-DEBUG)');
  log('========================================');

  win.onMessage('ready', function() {
    log('========================================');
    log('Page ready - Frontend initialized');
    log('========================================');
    
    // Acknowledge ready state to frontend
    try {
      win.postMessage('backendReady', { 
        version: PLUGIN_VERSION, 
        timestamp: Date.now(),
        status: 'ok'
      });
      log('Backend ready acknowledgment sent to frontend');
    } catch (e) {
      logError('Failed to send backendReady: ' + e.message);
    }
  });

  win.onMessage('connect', function(data) {
    handleConnect(data);
  });

  // Issue 1: Auto-connect handler for saved credentials
  win.onMessage('autoConnect', function(data) {
    log('autoConnect message received');
    handleConnect(data);
  });

  win.onMessage('disconnect', function() {
    handleDisconnect();
  });

  win.onMessage('load', function(data) {
    // IMMEDIATE LOGGING - FIRST LINE OF CALLBACK
    // This will tell us if the handler is being invoked at all
    var timestamp = Date.now();
    var timeStr = new Date(timestamp).toISOString();
    iina.console.log('========================================');
    iina.console.log('>>> MESSAGE HANDLER: "load" callback INVOKED <<<');
    iina.console.log('>>> Timestamp: ' + timeStr + ' (' + timestamp + ')');
    iina.console.log('>>> data type: ' + typeof data);
    iina.console.log('>>> data is null: ' + (data === null));
    iina.console.log('>>> data is undefined: ' + (data === undefined));
    if (data) {
      iina.console.log('>>> data.type: ' + (data.type || 'MISSING'));
      iina.console.log('>>> data.category: ' + (data.category || 'none'));
      iina.console.log('>>> Full data: ' + JSON.stringify(data));
    } else {
      iina.console.log('>>> data is null/undefined - no payload to log');
    }
    iina.console.log('========================================');
    
    // Send acknowledgment to frontend
    try {
      win.postMessage('loadReceived', { 
        received: true, 
        timestamp: timestamp,
        type: data ? data.type : 'unknown'
      });
      iina.console.log('>>> loadReceived acknowledgment sent to frontend');
    } catch (e) {
      iina.console.log('>>> Failed to send loadReceived: ' + e.message);
    }
    
    // Now call the actual handler
    handleLoad(data);
  });

  win.onMessage('play', function(data) {
    log('╔══════════════════════════════════════════════════════════════╗');
    log('║  MESSAGE HANDLER: "play" message RECEIVED                    ║');
    log('╚══════════════════════════════════════════════════════════════╝');
    log('  📥 Raw data received:');
    log('    - type: ' + typeof data);
    log('    - is null: ' + (data === null));
    log('    - is undefined: ' + (data === undefined));
    log('    - has id: ' + (data && data.id !== undefined));
    log('    - has type: ' + (data && data.type !== undefined));
    log('    - has ext: ' + (data && data.ext !== undefined));
    log('    - has name: ' + (data && data.name !== undefined));
    log('    - has directStream: ' + (data && data.directStream !== undefined));
    log('    - timestamp: ' + (data && data.timestamp ? data.timestamp : 'N/A'));
    
    if (data) {
      try {
        log('  📋 Full data: ' + JSON.stringify(data));
      } catch (e) {
        log('  📋 Full data: [Circular structure]');
      }
      
      if (data.id !== undefined) {
        log('  🔑 Stream ID: ' + data.id + ' (type: ' + typeof data.id + ')');
      }
      if (data.type !== undefined) {
        log('  📺 Stream type: ' + data.type);
      }
    }
    
    // Send acknowledgment back to browser
    log('');
    log('  📡 Sending acknowledgment "playReceived" to browser...');
    try {
      win.postMessage('playReceived', { received: true, timestamp: Date.now(), serverTimestamp: Date.now() });
      log('  ✅ Acknowledgment sent successfully');
    } catch (e) {
      logError('  ❌ Failed to send acknowledgment: ' + e.message);
    }
    
    log('');
    log('  🔧 Calling handlePlay()...');
    
    try {
      handlePlay(data);
      log('');
      log('  ✅ handlePlay() completed successfully');
    } catch (e) {
      logError('  ❌ handlePlay() threw exception: ' + e.message);
      logError('  Stack: ' + (e.stack || 'no stack'));
    }
    
    log('');
    log('  <<< "play" message handler completed >>>');
  });

  win.onMessage('favorite', function(data) {
    handleFavorite(data);
  });

  win.onMessage('search', function(data) {
    handleSearch(data);
  });
  
  win.onMessage('getEpg', function(data) {
    handleGetEpg(data);
  });
  
  win.onMessage('clearCache', function() {
    clearCache();
  });

  win.onMessage('loadSeriesInfo', function(data) {
    log('>>> MESSAGE HANDLER: "loadSeriesInfo" message received');
    handleLoadSeriesInfo(data);
    log('<<< MESSAGE HANDLER: "loadSeriesInfo" handler completed');
  });
  
  // Issue 3: Resume position tracking handlers
  win.onMessage('updateResumePosition', function(data) {
    log('>>> MESSAGE HANDLER: "updateResumePosition" received');
    if (data && data.streamId && data.position !== undefined) {
      updateResumePosition(data.streamId, data.position, data.duration);
    }
  });
  
  win.onMessage('getResumePosition', function(data) {
    log('>>> MESSAGE HANDLER: "getResumePosition" received');
    if (data && data.streamId) {
      var resumeData = getResumePosition(data.streamId);
      win.postMessage('resumePosition', {
        streamId: data.streamId,
        data: resumeData
      });
    }
  });
  
  log('========================================');
  log('All message handlers registered successfully');
  log('Handlers: ready, connect, disconnect, load, play, favorite, search, getEpg, clearCache, loadSeriesInfo, updateResumePosition, getResumePosition');
  log('========================================');
  
  // Debug: Verify play handler is specifically registered
  log('>>> VERIFICATION: "play" handler registered with win.onMessage');
  log('>>> If play messages are not received, check:');
  log('>>>   1. Is the standalone window open? win.open() called?');
  log('>>>   2. Is the correct HTML file loaded in the window?');
  log('>>>   3. Is iina.postMessage being called from browser.js?');
  
  // Mark as setup to prevent duplicate registration
  messageHandlersSetup = true;
  log('>>> Message handlers setup complete - flag set to prevent duplicate registration');
}

// ============================================
// CONNECTION HANDLING
// ============================================

/**
 * Handle connection request
 * @param {Object} data - Connection data
 * @param {string} data.server - Server URL
 * @param {string} data.username - Username
 * @param {string} data.password - Password
 * @param {boolean} [data.rememberMe] - Whether to save credentials
 */
async function handleConnect(data) {
  log('handleConnect started');

  var server = (data.server || '').trim();
  if (server.indexOf('http') !== 0) {
    server = 'http://' + server;
  }

  var creds = {
    server: server,
    username: (data.username || '').trim(),
    password: (data.password || '').trim()
  };

  if (!creds.server || !creds.username || !creds.password) {
    win.postMessage('error', 'Please fill in all fields');
    return;
  }

  log('Creating API client for: ' + server);
  state.api = new XtreamAPI(creds);

  try {
    log('Testing connection...');
    var result = await state.api.request('get_live_categories');

    if (!Array.isArray(result)) {
      throw new Error('Invalid response from server');
    }

    log('Connection successful! Got ' + result.length + ' categories');
    state.isConnected = true;
    state.credentials = creds;
    
    // Save credentials only if rememberMe is true (default to true for backward compatibility)
    var shouldRemember = data.rememberMe !== false;
    await saveCredentials(creds, shouldRemember);
    
    clearCache(); // Fresh cache on new connection

    win.postMessage('success');
    showBrowserPage();
  } catch (err) {
    logError('Connection failed: ' + err.message);
    state.api = null;
    win.postMessage('error', 'Connection failed: ' + err.message);
  }
}

/**
 * Handle disconnect request
 * @param {boolean} [clearCreds=false] - Whether to clear saved credentials
 */
async function handleDisconnect(clearCreds) {
  log('>>> handleDisconnect CALLED');
  log('  Disconnecting from server: ' + (state.credentials ? state.credentials.server : 'unknown'));
  log('  Clear credentials: ' + (clearCreds ? 'YES' : 'NO'));
  
  state.isConnected = false;
  state.api = null;
  state.credentials = null;
  
  // Only clear credentials if explicitly requested (logout)
  if (clearCreds) {
    await clearCredentials();
  }
  
  clearCache();
  
  win.loadFile('connection.html');
  setTimeout(async function() {
    var creds = await loadCredentials();
    win.postMessage('init', creds);
  }, 300);
  
  log('✓ Disconnected and returned to connection screen');
  log('<<< handleDisconnect END');
}

// ============================================
// CONTENT LOADING
// ============================================

/**
 * Handle load content request
 * @param {Object} data - Load request data
 * @param {string} data.type - Content type (live, vod, series, favorites, history)
 * @param {string} [data.category] - Category ID
 */
async function handleLoad(data) {
  log('========================================');
  log('[handleLoad] FUNCTION ENTRY');
  log('========================================');
  log('[handleLoad] >>> handleLoad CALLED');
  log('[handleLoad]  type: ' + (data.type || 'undefined'));
  log('[handleLoad]  category: ' + (data.category || 'none'));
  log('[handleLoad]  API connected: ' + (state.api ? 'YES' : 'NO'));
  log('[handleLoad]  Timestamp: ' + Date.now());
  
  var startTime = Date.now();
  var type = data.type;
  var cat = data.category;

  try {
    if (cat) {
      log('[handleLoad] Loading streams for category: ' + cat);
      await loadStreams(type, cat);
    } else if (type === 'favorites') {
      var favCount = Object.keys(state.favorites).length;
      log('[handleLoad] Loading favorites: ' + favCount + ' items');
      win.postMessage('render', Object.values(state.favorites));
      log('✓ Favorites sent to frontend');
    } else if (type === 'history') {
      log('[handleLoad] Loading history: ' + state.history.length + ' items');
      win.postMessage('history', state.history);
      log('✓ History sent to frontend');
    } else {
      log('[handleLoad] Loading categories for type: ' + type);
      await loadCategories(type);
    }
    
    log('[handleLoad] <<< handleLoad END (success) - duration: ' + (Date.now() - startTime) + 'ms');
  } catch (e) {
    logError('========================================');
    logError('[handleLoad] EXCEPTION CAUGHT');
    logError('========================================');
    logError('[handleLoad] Error: ' + e.message);
    if (e.stack) {
      logError('[handleLoad] Stack: ' + e.stack);
    }
    logError('========================================');
    
    // ALWAYS send empty data to frontend to prevent infinite loading
    try {
      if (cat) {
        win.postMessage('render', []);
      } else if (type === 'favorites' || type === 'history') {
        win.postMessage('render', []);
      } else {
        win.postMessage('categories', []);
      }
      log('[handleLoad] ✓ Sent empty response to frontend');
    } catch (postErr) {
      logError('[handleLoad] Failed to send empty response: ' + postErr.message);
    }
    
    // ALWAYS send error message
    try {
      win.postMessage('error', 'Failed to load content: ' + e.message);
      log('[handleLoad] ✓ Sent error message to frontend');
    } catch (postErr) {
      logError('[handleLoad] Failed to send error: ' + postErr.message);
    }
    
    log('[handleLoad] <<< handleLoad END (error) - duration: ' + (Date.now() - startTime) + 'ms');
  }
}

/**
 * Handle load series info request
 * @param {Object} data - Series info request data
 * @param {string} data.seriesId - Series ID
 * @param {string} [data.seriesName] - Series name (fallback)
 */
async function handleLoadSeriesInfo(data) {
  log('>>> handleLoadSeriesInfo CALLED');
  log('  data: ' + JSON.stringify(data));
  log('  API connected: ' + (state.api ? 'YES' : 'NO'));
  log('  seriesId present: ' + (data && data.seriesId ? 'YES' : 'NO'));
  
  if (!state.api || !data.seriesId) {
    logError('Cannot load series info: API not connected or missing seriesId');
    // Send error to frontend so it can hide loading spinner
    try {
      win.postMessage('error', 'Cannot load series: Not connected or missing ID');
    } catch (e) {
      logError('Failed to send error message: ' + e.message);
    }
    return;
  }

  try {
    log('Loading series info for: ' + data.seriesId);

    // Appel API get_series_info
    log('handleLoadSeriesInfo: Calling API with series_id=' + data.seriesId);
    var seriesInfo = await state.api.request('get_series_info', {
      series_id: data.seriesId
    });

    log('handleLoadSeriesInfo: API response received');
    log('handleLoadSeriesInfo: Response structure: ' + JSON.stringify({
      hasInfo: !!seriesInfo.info,
      hasEpisodes: !!seriesInfo.episodes,
      episodesType: typeof seriesInfo.episodes,
      isEpisodesArray: Array.isArray(seriesInfo.episodes),
      episodeKeys: seriesInfo.episodes ? Object.keys(seriesInfo.episodes) : 'N/A',
      infoName: seriesInfo.info ? seriesInfo.info.name : 'N/A'
    }));
    
    // Log first episode data structure if available
    if (seriesInfo.episodes) {
      var firstSeasonKey = Object.keys(seriesInfo.episodes)[0];
      if (firstSeasonKey && seriesInfo.episodes[firstSeasonKey] && seriesInfo.episodes[firstSeasonKey].length > 0) {
        var firstEp = seriesInfo.episodes[firstSeasonKey][0];
        log('handleLoadSeriesInfo: First episode sample: ' + JSON.stringify({
          keys: Object.keys(firstEp),
          id: firstEp.id,
          stream_id: firstEp.stream_id,
          episode_id: firstEp.episode_id,
          title: firstEp.title,
          episode_num: firstEp.episode_num,
          container_extension: firstEp.container_extension
        }));
      }
    }

    if (!seriesInfo || !seriesInfo.episodes) {
      throw new Error('No episodes found for this series');
    }

    // Structurer les données pour le frontend
    // L'API retourne episodes comme objet: { "1": [...], "2": [...] }
    // Le frontend s'attend à ce format et le convertira en tableau
    log('handleLoadSeriesInfo: Preparing to send seriesInfo message to frontend');
    log('handleLoadSeriesInfo: Response data structure:');
    log('  - seriesId: ' + data.seriesId);
    log('  - name: ' + (seriesInfo.info.name || data.seriesName || 'Unknown Series'));
    log('  - cover: ' + (seriesInfo.info.cover ? 'present' : 'empty'));
    log('  - seasons type: ' + typeof seriesInfo.episodes);
    log('  - seasons keys: ' + Object.keys(seriesInfo.episodes).join(','));
    
    var responsePayload = {
      seriesId: data.seriesId,
      name: seriesInfo.info.name || data.seriesName || 'Unknown Series',
      cover: seriesInfo.info.cover || '',
      plot: seriesInfo.info.plot || '',
      rating: seriesInfo.info.rating || '',
      genre: seriesInfo.info.genre || '',
      seasons: seriesInfo.episodes  // { "1": [...], "2": [...] }
    };
    
    log('handleLoadSeriesInfo: Calling win.postMessage(seriesInfo, ...)');
    try {
      win.postMessage('seriesInfo', responsePayload);
      log('handleLoadSeriesInfo: ✅ win.postMessage completed successfully');
    } catch (e) {
      logError('handleLoadSeriesInfo: ❌ win.postMessage FAILED: ' + e.message);
    }

    log('Series info loaded successfully: ' + (seriesInfo.info.name || data.seriesName));
  } catch (e) {
    logError('Failed to load series info: ' + e.message);
    logError('Stack: ' + (e.stack || 'no stack'));
    try {
      win.postMessage('error', 'Failed to load series: ' + e.message);
      log('Error message sent to frontend');
    } catch (err) {
      logError('Failed to send error message to frontend: ' + err.message);
    }
  }
  log('<<< handleLoadSeriesInfo END');
}

/**
 * Load categories with caching and timeout
 * @param {string} type - Content type
 */
async function loadCategories(type) {
  // IMMEDIATE LOGGING - This is the FIRST thing that executes
  var startTime = Date.now();
  log('========================================');
  log('[loadCategories] FUNCTION ENTRY');
  log('========================================');
  log('[loadCategories] START - type=' + type + ' at ' + new Date(startTime).toISOString());
  log('[loadCategories] Timestamp: ' + Date.now());
  log('[loadCategories] Received type parameter: "' + type + '"');
  
  try {
    // Validate state.api exists
    if (!state.api) {
      logError('[loadCategories] Cannot load categories - no API instance');
      logError('[loadCategories] state.api is null or undefined');
      win.postMessage('categories', []);
      log('[loadCategories] END (no API) - duration: ' + (Date.now() - startTime) + 'ms');
      return;
    }
    log('[loadCategories] ✓ API instance exists');

    var action;
    var cacheKey;
    if (type === 'live') {
      action = 'get_live_categories';
      cacheKey = 'liveCategories';
    } else if (type === 'vod') {
      action = 'get_vod_categories';
      cacheKey = 'vodCategories';
    } else if (type === 'series') {
      action = 'get_series_categories';
      cacheKey = 'seriesCategories';
    } else {
      logError('[loadCategories] Unknown content type: ' + type);
      win.postMessage('categories', []);
      log('[loadCategories] END (unknown type) - duration: ' + (Date.now() - startTime) + 'ms');
      return;
    }
    log('[loadCategories] ✓ Action determined: ' + action);
    log('[loadCategories] ✓ Cache key: ' + cacheKey);

    // Check cache first
    if (isCacheValid(state.cache[cacheKey])) {
      log('[loadCategories] Using cached ' + type + ' categories');
      win.postMessage('categories', state.cache[cacheKey].data);
      log('[loadCategories] END (from cache) - duration: ' + (Date.now() - startTime) + 'ms');
      return;
    }
    log('[loadCategories] Cache miss - fetching from server');

    log('[loadCategories] Loading ' + type + ' categories from server...');
    log('[loadCategories] Calling API with action: ' + action);

    // Apply 10 second timeout to the request
    var cats = await withTimeout(
      state.api.request(action),
      10000,
      'Loading ' + type + ' categories'
    );
    log('[loadCategories] ✓ API request completed');

    if (!cats || !Array.isArray(cats)) {
      logError('[loadCategories] Invalid response from server');
      logError('[loadCategories] Response type: ' + typeof cats);
      logError('[loadCategories] Is array: ' + Array.isArray(cats));
      throw new Error('Invalid response from server');
    }

    // Update cache
    state.cache[cacheKey] = {
      data: cats,
      timestamp: Date.now()
    };
    saveCache();

    log('[loadCategories] Loaded ' + cats.length + ' ' + type + ' categories');
    log('[loadCategories] Sending categories to frontend...');
    win.postMessage('categories', cats);
    log('[loadCategories] ✓ Categories sent successfully');
    log('[loadCategories] END (success) - duration: ' + (Date.now() - startTime) + 'ms');
  } catch (e) {
    logError('========================================');
    logError('[loadCategories] EXCEPTION CAUGHT');
    logError('========================================');
    logError('[loadCategories] Failed to load ' + type + ' categories');
    logError('[loadCategories] Error: ' + e.message);
    if (e.stack) {
      logError('[loadCategories] Stack: ' + e.stack);
    }
    logError('========================================');
    
    // ALWAYS send empty categories to frontend to prevent infinite loading
    try {
      win.postMessage('categories', []);
      log('[loadCategories] ✓ Sent empty categories array');
    } catch (postErr) {
      logError('[loadCategories] Failed to send categories: ' + postErr.message);
    }
    
    // ALWAYS send error message to frontend
    try {
      win.postMessage('error', 'Failed to load ' + type + ' categories: ' + e.message);
      log('[loadCategories] ✓ Sent error message to frontend');
    } catch (postErr) {
      logError('[loadCategories] Failed to send error: ' + postErr.message);
    }
    
    log('[loadCategories] END (error) - duration: ' + (Date.now() - startTime) + 'ms');
  }
}

/**
 * Load streams with caching and timeout
 * @param {string} type - Content type
 * @param {string} catId - Category ID
 */
async function loadStreams(type, catId) {
  // IMMEDIATE LOGGING - This is the FIRST thing that executes
  var startTime = Date.now();
  log('========================================');
  log('[loadStreams] FUNCTION ENTRY');
  log('========================================');
  log('[loadStreams] START - type=' + type + ', catId=' + catId + ' at ' + new Date(startTime).toISOString());
  log('[loadStreams] Timestamp: ' + Date.now());
  log('[loadStreams] Received type: "' + type + '"');
  log('[loadStreams] Received catId: "' + catId + '"');
  
  try {
    // Validate state.api exists
    if (!state.api) {
      logError('[loadStreams] Cannot load streams - no API instance');
      logError('[loadStreams] state.api is null or undefined');
      win.postMessage('render', []);
      log('[loadStreams] END (no API) - duration: ' + (Date.now() - startTime) + 'ms');
      return;
    }
    log('[loadStreams] ✓ API instance exists');

    var action;
    if (type === 'live') action = 'get_live_streams';
    else if (type === 'vod') action = 'get_vod_streams';
    else if (type === 'series') action = 'get_series';
    else {
      logError('[loadStreams] Unknown stream type: ' + type);
      win.postMessage('render', []);
      log('[loadStreams] END (unknown type) - duration: ' + (Date.now() - startTime) + 'ms');
      return;
    }
    log('[loadStreams] ✓ Action determined: ' + action);

    // Check cache
    var cacheKey = getStreamCacheKey(type, catId);
    log('[loadStreams] Cache key: ' + cacheKey);
    if (isCacheValid(state.cache.streams[cacheKey])) {
      log('[loadStreams] Using cached streams for ' + type + ' category ' + catId);
      win.postMessage('render', state.cache.streams[cacheKey].data);
      log('[loadStreams] END (from cache) - duration: ' + (Date.now() - startTime) + 'ms');
      return;
    }
    log('[loadStreams] Cache miss - fetching from server');

    log('[loadStreams] Loading streams for ' + type + ' category ' + catId + '...');
    log('[loadStreams] Calling API with action: ' + action);

    // Apply 10 second timeout to the request
    var streams = await withTimeout(
      state.api.request(action, { category_id: catId }),
      10000,
      'Loading ' + type + ' streams'
    );
    log('[loadStreams] ✓ API request completed');

    if (!streams || !Array.isArray(streams)) {
      logError('[loadStreams] Invalid response from server');
      logError('[loadStreams] Response type: ' + typeof streams);
      logError('[loadStreams] Is array: ' + Array.isArray(streams));
      throw new Error('Invalid response from server');
    }

    // Update cache
    state.cache.streams[cacheKey] = {
      data: streams,
      timestamp: Date.now()
    };
    saveCache();

    log('[loadStreams] Loaded ' + streams.length + ' ' + type + ' streams');
    log('[loadStreams] Sending streams to frontend...');
    win.postMessage('render', streams);
    log('[loadStreams] ✓ Streams sent successfully');
    log('[loadStreams] END (success) - duration: ' + (Date.now() - startTime) + 'ms');
  } catch (e) {
    logError('========================================');
    logError('[loadStreams] EXCEPTION CAUGHT');
    logError('========================================');
    logError('[loadStreams] Failed to load ' + type + ' streams');
    logError('[loadStreams] Error: ' + e.message);
    if (e.stack) {
      logError('[loadStreams] Stack: ' + e.stack);
    }
    logError('========================================');
    
    // ALWAYS send empty streams to frontend to prevent infinite loading
    try {
      win.postMessage('render', []);
      log('[loadStreams] ✓ Sent empty streams array');
    } catch (postErr) {
      logError('[loadStreams] Failed to send streams: ' + postErr.message);
    }
    
    // ALWAYS send error message to frontend
    try {
      win.postMessage('error', 'Failed to load ' + type + ' streams: ' + e.message);
      log('[loadStreams] ✓ Sent error message to frontend');
    } catch (postErr) {
      logError('[loadStreams] Failed to send error: ' + postErr.message);
    }
    
    log('[loadStreams] END (error) - duration: ' + (Date.now() - startTime) + 'ms');
  }
}

// ============================================
// PLAYBACK & FAVORITES
// ============================================

/**
 * Handle play request
 * @param {Object} data - Play request data
 * @param {string} data.id - Stream ID
 * @param {string} data.type - Stream type
 * @param {string} [data.ext] - File extension
 * @param {string} [data.name] - Stream name
 * @param {number} [data.resumePosition] - Optional resume position in seconds
 */
async function handlePlay(data) {
  var startTime = Date.now();
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║           handlePlay() START                                 ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log('  🕐 Start time: ' + new Date(startTime).toISOString());
  log('');
  log('  📥 STEP 1: Validating input data...');
  log('    - data is null: ' + (data === null));
  log('    - data is undefined: ' + (data === undefined));
  log('    - data type: ' + typeof data);
   
  if (!data) {
    logError('  ❌ CRITICAL: data is null/undefined - cannot proceed');
    log('═══════════════ handlePlay END (no data) ═══════════════');
    return;
  }
   
  log('    - data.id: ' + (data.id !== undefined ? data.id : 'MISSING'));
  log('    - data.type: ' + (data.type !== undefined ? data.type : 'MISSING'));
  log('    - data.ext: ' + (data.ext !== undefined ? data.ext : 'MISSING'));
  log('    - data.name: ' + (data.name !== undefined ? data.name : 'MISSING'));
  log('    - data.directStream: ' + data.directStream);
  log('    - data.resumePosition: ' + (data.resumePosition !== undefined ? data.resumePosition : 'NOT PROVIDED'));
  log('');
  log('  🔧 STEP 2: Checking API connection...');
  log('    - state.api exists: ' + (state.api !== null));
  log('    - state.api type: ' + typeof state.api);
  log('    - state.isConnected: ' + state.isConnected);
   
  if (!state.api) {
    logError('  ❌ CRITICAL: No API instance available');
    log('═══════════════ handlePlay END (no API) ═══════════════');
    return;
  }
  log('  ✅ API is available');
   
  if (!data.id) {
    logError('  ❌ CRITICAL: missing stream ID in data');
    log('  Available keys: ' + Object.keys(data || {}).join(', '));
    log('═══════════════ handlePlay END (no id) ═══════════════');
    return;
  }
  log('  ✅ Stream ID is present: ' + data.id);
   
  var id = data.id;
  var type = data.type;
  var ext = data.ext;
  var name = data.name;
  var resumePosition = data.resumePosition;  // Get resume position from data
   
  log('');
  log('  📝 STEP 3: Extracting parameters');
  log('    - id: "' + id + '" (type: ' + typeof id + ')');
  log('    - type: "' + type + '" (type: ' + typeof type + ')');
  log('    - ext: "' + ext + '" (type: ' + typeof ext + ')');
  log('    - name: "' + name + '" (type: ' + typeof name + ')');
  log('    - directStream: ' + data.directStream);
  log('    - resumePosition: ' + (resumePosition ? resumePosition + 's' : 'none'));
   
  // Si c'est une série, vérifier si on a déjà un stream_id d'épisode direct
  // Le browser.js envoie directement le stream_id quand un épisode spécifique est sélectionné
  if (type === 'series' && !data.directStream) {
    log('');
    log('  📺 STEP 4a: Series without directStream - fetching series info');
    try {
      log('    Fetching series info for series_id: ' + id);
      var seriesInfo = await state.api.request('get_series_info', { series_id: id });
       
      log('    Series info received:');
      log('      - has info: ' + (seriesInfo && seriesInfo.info ? 'yes' : 'no'));
      log('      - has episodes: ' + (seriesInfo && seriesInfo.episodes ? 'yes' : 'no'));
 
      if (!seriesInfo || !seriesInfo.episodes) {
        throw new Error('No episodes found for this series');
      }
 
      // Trouver la première saison et le premier épisode
      var seasons = Object.keys(seriesInfo.episodes).sort();
      log('    Available seasons: ' + seasons.join(', '));
       
      if (seasons.length === 0) {
        throw new Error('No seasons found');
      }
 
      var firstSeason = seriesInfo.episodes[seasons[0]];
      log('    First season episodes count: ' + (firstSeason ? firstSeason.length : 0));
       
      if (!firstSeason || firstSeason.length === 0) {
        throw new Error('No episodes in first season');
      }
 
      var firstEpisode = firstSeason[0];
      log('    First episode data:');
      log('      - id: ' + firstEpisode.id);
      log('      - stream_id: ' + firstEpisode.stream_id);
      log('      - title: ' + firstEpisode.title);
      log('      - container_extension: ' + firstEpisode.container_extension);
       
      // FIX: Use 'id' field which is the standard for Xtream API episodes
      // Fallback to 'stream_id' for compatibility with some providers
      id = firstEpisode.id || firstEpisode.stream_id;
      ext = firstEpisode.container_extension || ext;
      name = firstEpisode.title || name;
 
      log('  ✅ Using first episode: ' + name + ' (episode_id: ' + id + ')');
    } catch (e) {
      logError('  ❌ Failed to load series: ' + e.message);
      log('═══════════════ handlePlay END (series error) ═══════════════');
      return;
    }
  } else if (type === 'series' && data.directStream) {
    log('');
    log('  📺 STEP 4b: Series episode with directStream=true');
    log('    Using provided stream_id: ' + id);
  } else {
    log('');
    log('  📺 STEP 4c: Non-series type or directStream not set');
    log('    type=' + type + ', directStream=' + data.directStream);
  }
 
  // Validate we have required values
  if (!id) {
    logError('');
    logError('  ❌ CRITICAL: id is empty after processing');
    log('═══════════════ handlePlay END (empty id) ═══════════════');
    return;
  }
 
  log('');
  log('  🔗 STEP 5: Building stream URL');
  log('    Parameters - id=' + id + ', type=' + type + ', ext=' + ext);
   
  var url;
  try {
    url = state.api.getStreamUrl(id, type, ext);
    log('  ✅ URL built successfully');
    log('    Final URL: ' + url);
  } catch (e) {
    logError('  ❌ Failed to build URL: ' + e.message);
    log('═══════════════ handlePlay END (URL build error) ═══════════════');
    return;
  }
 
  log('');
  log('  💾 STEP 6: Updating history');
  log('    Before update: ' + state.history.length + ' items');
    
  // Issue 2: Use enhanced addToHistory function
  // CRITICAL FIX: Pass series_id if available (for episodes played from series page)
  var historyItem = {
    id: id,
    name: name || 'Unknown',
    type: type,
    thumbnail: data.thumbnail || data.stream_icon || data.cover || '',
    container_extension: ext,
    rating: data.rating || '',
    plot: data.plot || ''
  };
  
  // If this is a series episode with a series_id in the data, pass it
  if (data.series_id) {
    historyItem.series_id = data.series_id;
    log('  📎 Including series_id in history: ' + data.series_id);
  }
  
  await addToHistory(historyItem);
  log('  ✅ History updated: ' + state.history.length + ' items');
 
  log('');
  log('  ▶️  STEP 7: Opening stream in IINA');
  log('    URL: ' + url);
   
  try {
    log('    Storing play request in preferences for main.js...');
    
    // Store play request in preferences - main.js will poll and play
    var playRequest = {
      url: url,
      name: name,
      type: type,
      streamId: id,  // Pass streamId for tracking
      resumePosition: resumePosition,  // Pass resume position if provided by user choice
      timestamp: Date.now()
    };
    
    prefs.set('iptv_play_request', JSON.stringify(playRequest));
    log('    ✅ Play request stored: ' + JSON.stringify(playRequest));
    
    var elapsed = Date.now() - startTime;
    log('  ✅✅✅ Play request queued successfully!');
    log('     Total time: ' + elapsed + 'ms');
  } catch (e) {
    logError('  ❌❌❌ Failed to queue play request!');
    logError('    Error: ' + e.message);
    logError('    Stack: ' + (e.stack || 'no stack'));
  }
  
  log('');
  log('  <<< handlePlay() COMPLETED >>>');
  log('  Total execution time: ' + (Date.now() - startTime) + 'ms');
}

/**
 * Handle favorite toggle
 * @param {Object} data - Favorite data
 * @param {string} data.id - Stream ID
 * @param {string} data.type - Stream type
 * @param {string} [data.name] - Stream name
 */
function handleFavorite(data) {
  log('>>> handleFavorite CALLED');
  
  if (!data || !data.id) {
    logError('handleFavorite: Invalid data or missing ID');
    return;
  }
  
  var id = data.id;
  var type = data.type || 'unknown';
  var name = data.name || 'Unknown';
  
  log('  id: ' + id);
  log('  type: ' + type);
  log('  name: ' + name);
  
  if (state.favorites[id]) {
    delete state.favorites[id];
    log('✓ Removed from favorites: ' + name + ' (' + id + ')');
  } else {
    state.favorites[id] = {
      id: id,
      type: type,
      name: name,
      addedAt: Date.now()
    };
    log('✓ Added to favorites: ' + name + ' (' + id + ')');
  }
  
  log('  Total favorites: ' + Object.keys(state.favorites).length);
  
  saveFavorites();
  win.postMessage('favorites', state.favorites);
  log('<<< handleFavorite END');
}

// ============================================
// SEARCH (MULTI-TYPE)
// ============================================

/**
 * Handle search request across all content types
 * @param {Object} data - Search data
 * @param {string} data.query - Search query
 */
async function handleSearch(data) {
  log('>>> handleSearch CALLED');
  log('  query: ' + (data.query || 'EMPTY'));
  log('  API connected: ' + (state.api ? 'YES' : 'NO'));
  
  if (!state.api) {
    logError('handleSearch: API not connected');
    win.postMessage('render', []);
    return;
  }

  var query = (data.query || '').toLowerCase().trim();
  if (query.length < 2) {
    log('handleSearch: query too short, returning empty results');
    win.postMessage('render', []);
    return;
  }

  // Clear previous debounce timer
  if (state.searchDebounceTimer) {
    clearTimeout(state.searchDebounceTimer);
  }

  // Debounce search
  state.searchDebounceTimer = setTimeout(async function() {
    log('=== Search executing for: ' + query + ' ===');
    
    try {
      var results = [];
      var errors = [];
      
      // Search live streams
      try {
        log('Searching live streams...');
        var liveStreams = await state.api.request('get_live_streams');
        if (Array.isArray(liveStreams)) {
          var liveResults = liveStreams.filter(function(s) {
            return s.name && s.name.toLowerCase().indexOf(query) !== -1;
          }).map(function(s) {
            s.searchType = 'live';
            return s;
          });
          results = results.concat(liveResults);
          log('Live search: ' + liveResults.length + ' results');
        }
      } catch (e) {
        logError('Live search error: ' + e.message);
        errors.push('Live: ' + e.message);
      }
      
      // Search VOD
      try {
        log('Searching VOD...');
        var vodStreams = await state.api.request('get_vod_streams');
        if (Array.isArray(vodStreams)) {
          var vodResults = vodStreams.filter(function(s) {
            return s.name && s.name.toLowerCase().indexOf(query) !== -1;
          }).map(function(s) {
            s.searchType = 'vod';
            return s;
          });
          results = results.concat(vodResults);
          log('VOD search: ' + vodResults.length + ' results');
        }
      } catch (e) {
        logError('VOD search error: ' + e.message);
        errors.push('VOD: ' + e.message);
      }
      
      // Search Series
      try {
        log('Searching Series...');
        var series = await state.api.request('get_series');
        if (Array.isArray(series)) {
          var seriesResults = series.filter(function(s) {
            return s.name && s.name.toLowerCase().indexOf(query) !== -1;
          }).map(function(s) {
            s.searchType = 'series';
            return s;
          });
          results = results.concat(seriesResults);
          log('Series search: ' + seriesResults.length + ' results');
        }
      } catch (e) {
        logError('Series search error: ' + e.message);
        errors.push('Series: ' + e.message);
      }
      
      // Sort by relevance (exact match first)
      results.sort(function(a, b) {
        var aExact = a.name.toLowerCase() === query;
        var bExact = b.name.toLowerCase() === query;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return a.name.localeCompare(b.name);
      });
      
      // Limit results
      results = results.slice(0, MAX_SEARCH_RESULTS);
      
      log('=== Search complete: ' + results.length + ' total results ===');
      win.postMessage('render', results);
      
    } catch (e) {
      logError('Search failed: ' + e.message);
      win.postMessage('render', []);
    }
  }, 300); // 300ms debounce
  
  log('<<< handleSearch END (debounced)');
}

// ============================================
// EPG (ELECTRONIC PROGRAM GUIDE)
// ============================================

/**
 * Handle EPG request
 * @param {Object} data - EPG request data
 * @param {string} data.streamId - Stream ID
 */
async function handleGetEpg(data) {
  log('>>> handleGetEpg CALLED');
  
  if (!state.api || !data || !data.streamId) {
    logError('handleGetEpg: Invalid request - api=' + !!state.api + ', streamId=' + (data ? data.streamId : 'null'));
    win.postMessage('epgData', { error: 'Invalid request' });
    return;
  }

  var streamId = data.streamId;
  log('  streamId: ' + streamId);
  log('  API connected: ' + (state.api ? 'YES' : 'NO'));

  try {
    log('[EPG] Requesting EPG for stream: ' + streamId);
    var startTime = Date.now();
    var epg = await state.api.getEpg(streamId);
    var elapsed = Date.now() - startTime;
    
    var programs = epg && Array.isArray(epg) ? epg.length : 0;
    log('[EPG] Response received: ' + programs + ' programs (' + elapsed + 'ms)');
    
    win.postMessage('epgData', { streamId: streamId, data: epg });
    log('✓ EPG data sent to frontend');
  } catch (e) {
    logError('[EPG] Failed to get EPG: ' + e.message);
    win.postMessage('epgData', { streamId: streamId, error: e.message });
  }
  
  log('<<< handleGetEpg END');
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Clear all cache
 */
function clearCache() {
  log('>>> clearCache CALLED');
  
  var streamCacheCount = Object.keys(state.cache.streams).length;
  log('  Clearing cache - stream caches: ' + streamCacheCount);
  
  state.cache = {
    liveCategories: { data: null, timestamp: 0 },
    vodCategories: { data: null, timestamp: 0 },
    seriesCategories: { data: null, timestamp: 0 },
    streams: {}
  };
  
  try {
    prefs.set('iptv_cache', null);
    log('✓ Cache cleared and persisted');
  } catch (e) {
    logError('Failed to clear persisted cache: ' + e.message);
  }
  
  log('<<< clearCache END');
}

// ============================================
// MENU REGISTRATION
// ============================================

log('========================================');
log('Attempting to register menu item...');
log('========================================');

// Wrap menu registration in try-catch to prevent silent failures
try {
  // Verify required APIs are available
  if (typeof menu === 'undefined') {
    logError('CRITICAL: iina.menu is NOT available!');
    logError('Plugin cannot register menu item');
    throw new Error('iina.menu API not available');
  }
  
  if (typeof menu.item !== 'function') {
    logError('CRITICAL: menu.item() is NOT a function!');
    logError('Plugin cannot register menu item');
    throw new Error('menu.item() method not available');
  }
  
  if (typeof menu.addItem !== 'function') {
    logError('CRITICAL: menu.addItem() is NOT a function!');
    logError('Plugin cannot register menu item');
    throw new Error('menu.addItem() method not available');
  }
  
  log('✓ All required menu APIs are available');
  log('Creating menu item: "Open IPTV"...');
  
  var menuItem = menu.item('Open IPTV', showWindow);
  
  if (!menuItem) {
    logError('CRITICAL: menu.item() returned null/undefined!');
    throw new Error('menu.item() failed to create menu item');
  }
  
  log('✓ Menu item created successfully');
  log('Registering menu item with IINA...');
  
  menu.addItem(menuItem);
  
  log('✓✅✅ Menu item registered successfully!');
  log('Plugin should now be visible in: IINA → Plugin → Open IPTV');
  
} catch (menuError) {
  logError('========================================');
  logError('FATAL: Failed to register menu item!');
  logError('========================================');
  logError('Error: ' + menuError.message);
  logError('Stack: ' + (menuError.stack || 'no stack'));
  logError('');
  logError('The plugin will NOT appear in IINA\'s menu.');
  logError('Possible causes:');
  logError('  1. IINA version is too old (API incompatibility)');
  logError('  2. Plugin permissions not set correctly in Info.json');
  logError('  3. Plugin file corrupted during installation');
  logError('');
  logError('Please check IINA Console (Window → Console) for details.');
  logError('========================================');
}

log('=== Plugin v' + PLUGIN_VERSION + ' initialization complete ===');
