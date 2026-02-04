/**
 * IINA IPTV Plugin - Storage Manager
 * @module managers/storage
 */

'use strict';

var state = require('../core/state').state;
var MAX_HISTORY_ITEMS = require('../core/state').MAX_HISTORY_ITEMS;
var base64Encode = require('../utils/helpers').base64Encode;
var base64Decode = require('../utils/helpers').base64Decode;
var Logger = require('../utils/helpers').Logger;

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
 * Encode password for storage
 * @param {string} password - Plain text password
 * @returns {string}
 */
function encodePassword(password) {
  if (!password) return '';
  try {
    return base64Encode(password);
  } catch (e) {
    Logger.error('[Storage] Failed to encode password: ' + e.message);
    return password;
  }
}

/**
 * Decode password from storage
 * @param {string} encoded - Encoded password
 * @returns {string}
 */
function decodePassword(encoded) {
  if (!encoded) return '';
  try {
    return base64Decode(encoded);
  } catch (e) {
    return encoded;
  }
}

/**
 * Load credentials from storage (preferences only - 100% portable)
 * @returns {Promise<Object>}
 */
async function loadCredentials() {
  Logger.log('[Storage] Loading credentials...');

  try {
    // Use preferences only (100% portable)
    if (typeof iina !== 'undefined' && iina.preferences) {
      var server = iina.preferences.get(STORAGE_KEYS.SERVER);
      var username = iina.preferences.get(STORAGE_KEYS.USERNAME);
      var encodedPassword = iina.preferences.get(STORAGE_KEYS.PASSWORD);
      var rememberMe = iina.preferences.get(STORAGE_KEYS.REMEMBER_ME);

      if (server || username) {
        Logger.log('[Storage] Credentials loaded from preferences');
        return {
          server: server || '',
          username: username || '',
          password: decodePassword(encodedPassword || ''),
          rememberMe: rememberMe === 'true'
        };
      }

      // Try old non-prefixed keys for migration
      var oldServer = iina.preferences.get('server');
      var oldUsername = iina.preferences.get('username');
      var oldPassword = iina.preferences.get('password');

      if (oldServer || oldUsername) {
        Logger.log('[Storage] Migrating old credentials...');

        var migratedCredentials = {
          server: oldServer || '',
          username: oldUsername || '',
          password: oldPassword || '',
          rememberMe: true
        };

        iina.preferences.set(STORAGE_KEYS.SERVER, migratedCredentials.server || '');
        iina.preferences.set(STORAGE_KEYS.USERNAME, migratedCredentials.username || '');
        iina.preferences.set(STORAGE_KEYS.PASSWORD, encodePassword(migratedCredentials.password || ''));
        iina.preferences.set(STORAGE_KEYS.REMEMBER_ME, 'true');

        // Clear old keys
        iina.preferences.set('server', '');
        iina.preferences.set('username', '');
        iina.preferences.set('password', '');

        return migratedCredentials;
      }
    }

    // No credentials found
    return { server: '', username: '', password: '', rememberMe: false };

  } catch (e) {
    Logger.error('[Storage] Failed to load credentials: ' + e.message);
    return { server: '', username: '', password: '', rememberMe: false };
  }
}

/**
 * Save credentials to storage (preferences only - 100% portable)
 * @param {Object} c - Credentials object
 * @param {boolean} shouldRemember - Whether to save credentials
 * @returns {Promise<boolean>}
 */
async function saveCredentials(c, shouldRemember) {
  Logger.log('[Storage] Saving credentials...');

  try {
    if (shouldRemember) {
      if (typeof iina !== 'undefined' && iina.preferences) {
        iina.preferences.set(STORAGE_KEYS.SERVER, c.server || '');
        iina.preferences.set(STORAGE_KEYS.USERNAME, c.username || '');
        iina.preferences.set(STORAGE_KEYS.PASSWORD, encodePassword(c.password || ''));
        iina.preferences.set(STORAGE_KEYS.REMEMBER_ME, 'true');
      }
      Logger.log('[Storage] Credentials saved to preferences');
      return true;
    } else {
      // Clear credentials if remember me is not checked
      if (typeof iina !== 'undefined' && iina.preferences) {
        iina.preferences.set(STORAGE_KEYS.SERVER, '');
        iina.preferences.set(STORAGE_KEYS.USERNAME, '');
        iina.preferences.set(STORAGE_KEYS.PASSWORD, '');
        iina.preferences.set(STORAGE_KEYS.REMEMBER_ME, 'false');
      }
      Logger.log('[Storage] Credentials cleared from preferences');
      return true;
    }
  } catch (e) {
    Logger.error('[Storage] Failed to save credentials: ' + e.message);
    return false;
  }
}

/**
 * Clear all credentials from storage (preferences only - 100% portable)
 * @returns {Promise<boolean>}
 */
async function clearCredentials() {
  Logger.log('[Storage] Clearing all credentials (logout)...');

  try {
    // Clear preferences only
    if (typeof iina !== 'undefined' && iina.preferences) {
      iina.preferences.set(STORAGE_KEYS.SERVER, '');
      iina.preferences.set(STORAGE_KEYS.USERNAME, '');
      iina.preferences.set(STORAGE_KEYS.PASSWORD, '');
      iina.preferences.set(STORAGE_KEYS.REMEMBER_ME, 'false');
    }

    Logger.log('[Storage] All credentials cleared');
    return true;
  } catch (e) {
    Logger.error('[Storage] Failed to clear credentials: ' + e.message);
    return false;
  }
}

/**
 * Load favorites from storage
 */
function loadFavorites() {
  Logger.log('[Storage] Loading favorites...');
  try {
    if (typeof iina !== 'undefined' && iina.preferences) {
      var d = iina.preferences.get('iptv_favorites');
      if (d) {
        state.favorites = JSON.parse(d);
        var count = Object.keys(state.favorites).length;
        Logger.log('[Storage] Loaded ' + count + ' favorites');
      } else {
        Logger.log('[Storage] No favorites found in storage');
      }
    }
  } catch (e) {
    Logger.error('[Storage] Failed to load favorites: ' + e.message);
    state.favorites = {};
  }
}

/**
 * Save favorites to storage
 */
function saveFavorites() {
  try {
    var count = Object.keys(state.favorites).length;
    if (typeof iina !== 'undefined' && iina.preferences) {
      iina.preferences.set('iptv_favorites', JSON.stringify(state.favorites));
    }
    Logger.log('[Storage] Saved ' + count + ' favorites');
  } catch (e) {
    Logger.error('[Storage] Failed to save favorites: ' + e.message);
  }
}

/**
 * Load history from storage (preferences only - 100% portable)
 */
async function loadHistory() {
  Logger.log('[Storage] Loading history...');

  try {
    // Use preferences only (100% portable)
    if (typeof iina !== 'undefined' && iina.preferences) {
      var historyData = iina.preferences.get('iptv_history');
      if (historyData) {
        state.history = JSON.parse(historyData);
        Logger.log('[Storage] History loaded from preferences: ' + state.history.length + ' items');
      } else {
        state.history = [];
        Logger.log('[Storage] No history found');
      }
    } else {
      state.history = [];
    }
  } catch (e) {
    Logger.error('[Storage] Failed to load history: ' + e.message);
    state.history = [];
  }

  // Load resume positions
  try {
    if (typeof iina !== 'undefined' && iina.preferences) {
      var resumeData = iina.preferences.get('iptv_resume_positions');
      if (resumeData) {
        state.resumePositions = JSON.parse(resumeData);
        Logger.log('[Storage] Resume positions loaded from preferences');
      } else {
        state.resumePositions = {};
      }
    } else {
      state.resumePositions = {};
    }
  } catch (e) {
    Logger.error('[Storage] Failed to load resume positions: ' + e.message);
    state.resumePositions = {};
  }
}

/**
 * Save history to storage (preferences only - 100% portable)
 */
async function saveHistory() {
  try {
    if (typeof iina !== 'undefined' && iina.preferences) {
      iina.preferences.set('iptv_history', JSON.stringify(state.history));
      Logger.log('[Storage] History saved to preferences: ' + state.history.length + ' items');
    }
  } catch (e) {
    Logger.error('[Storage] Failed to save history: ' + e.message);
  }
}

/**
 * Save resume positions to storage (preferences only - 100% portable)
 */
async function saveResumePositions() {
  try {
    if (typeof iina !== 'undefined' && iina.preferences) {
      iina.preferences.set('iptv_resume_positions', JSON.stringify(state.resumePositions));
      Logger.log('[Storage] Resume positions saved to preferences');
    }
  } catch (e) {
    Logger.error('[Storage] Failed to save resume positions: ' + e.message);
  }
}

/**
 * Add item to history
 * @param {Object} item - Item to add to history
 */
async function addToHistory(item) {
  var uniqueKey = item.series_id || item.stream_id || item.id;

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
    thumbnail: item.thumbnail || item.stream_icon || item.cover || '',
    container_extension: item.container_extension || '',
    rating: item.rating || '',
    plot: item.plot || ''
  };

  // If this is an episode with a series_id, store it separately
  if (item.series_id) {
    historyEntry.series_id = item.series_id;
  }

  // Add to beginning
  state.history.unshift(historyEntry);

  // Trim to max items
  if (state.history.length > MAX_HISTORY_ITEMS) {
    state.history = state.history.slice(0, MAX_HISTORY_ITEMS);
  }

  await saveHistory();
}

/**
 * Update resume position for a stream
 * @param {string} streamId - Stream ID
 * @param {number} position - Position in seconds
 * @param {number} duration - Duration in seconds
 */
async function updateResumePosition(streamId, position, duration) {
  if (!streamId) return;

  state.resumePositions[String(streamId)] = {
    position: position,
    duration: duration,
    updatedAt: Date.now()
  };

  await saveResumePositions();
}

/**
 * Get resume position for a stream
 * @param {string} streamId - Stream ID
 * @returns {Object|null}
 */
function getResumePosition(streamId) {
  return state.resumePositions[String(streamId)] || null;
}

module.exports = {
  STORAGE_KEYS: STORAGE_KEYS,
  loadCredentials: loadCredentials,
  saveCredentials: saveCredentials,
  clearCredentials: clearCredentials,
  loadFavorites: loadFavorites,
  saveFavorites: saveFavorites,
  loadHistory: loadHistory,
  saveHistory: saveHistory,
  addToHistory: addToHistory,
  updateResumePosition: updateResumePosition,
  getResumePosition: getResumePosition
};
