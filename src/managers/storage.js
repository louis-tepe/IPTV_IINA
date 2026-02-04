/**
 * IINA IPTV Plugin - Storage Manager
 * @module managers/storage
 */

'use strict';

const { state, MAX_HISTORY_ITEMS } = require('../core/state');
const { base64Encode, base64Decode, Logger } = require('../utils/helpers');

/**
 * Storage keys with plugin prefix to avoid conflicts
 */
const STORAGE_KEYS = {
  SERVER: 'iptv_server',
  USERNAME: 'iptv_username',
  PASSWORD: 'iptv_password',
  REMEMBER_ME: 'iptv_remember_me'
};

class Storage {
  constructor() {
    this.keys = STORAGE_KEYS;
  }

  /**
   * Encode password for storage
   * @private
   */
  _encodePassword(password) {
    if (!password) return '';
    try {
      return base64Encode(password);
    } catch (e) {
      Logger.error(`[Storage] Failed to encode password: ${e.message}`);
      return password;
    }
  }

  /**
   * Decode password from storage
   * @private
   */
  _decodePassword(encoded) {
    if (!encoded) return '';
    try {
      return base64Decode(encoded);
    } catch (e) {
      return encoded;
    }
  }

  /**
   * Load configuration (Synchronous for init)
   * @returns {Object} Config object
   */
  getConfig() {
    Logger.log('[Storage] Loading configuration...');

    try {
      if (typeof iina !== 'undefined' && iina.preferences) {
        // Portable preferences
        const server = iina.preferences.get(this.keys.SERVER);
        const username = iina.preferences.get(this.keys.USERNAME);
        const encodedPassword = iina.preferences.get(this.keys.PASSWORD);
        const rememberMe = iina.preferences.get(this.keys.REMEMBER_ME);

        if (server || username) {
          return {
            server: server || '',
            username: username || '',
            password: this._decodePassword(encodedPassword || ''),
            rememberMe: rememberMe === 'true'
          };
        }

        // Migration logic for old keys
        const oldServer = iina.preferences.get('server');
        if (oldServer) {
          Logger.log('[Storage] Migrating legacy credentials...');
          const oldUser = iina.preferences.get('username') || '';
          const oldPass = iina.preferences.get('password') || '';
          
          const migrated = {
            server: oldServer,
            username: oldUser,
            password: oldPass,
            rememberMe: true
          };
          
          this.saveConfig(migrated, true);
          
          // Clear old
          iina.preferences.set('server', '');
          iina.preferences.set('username', '');
          iina.preferences.set('password', '');
          
          return migrated;
        }
      }
      
      return { server: '', username: '', password: '', rememberMe: false };
    } catch (e) {
      Logger.error(`[Storage] Failed to load config: ${e.message}`);
      return { server: '', username: '', password: '', rememberMe: false };
    }
  }

  /**
   * Save configuration
   * @param {Object} config 
   * @param {boolean} shouldRemember 
   */
  saveConfig(config, shouldRemember) {
    try {
      if (typeof iina === 'undefined' || !iina.preferences) return false;

      if (shouldRemember) {
        iina.preferences.set(this.keys.SERVER, config.server || '');
        iina.preferences.set(this.keys.USERNAME, config.username || '');
        iina.preferences.set(this.keys.PASSWORD, this._encodePassword(config.password || ''));
        iina.preferences.set(this.keys.REMEMBER_ME, 'true');
        Logger.log('[Storage] Configuration saved');
      } else {
        this.clearConfig();
      }
      return true;
    } catch (e) {
      Logger.error(`[Storage] Failed to save config: ${e.message}`);
      return false;
    }
  }

  /**
   * Clear configuration
   */
  clearConfig() {
    if (typeof iina !== 'undefined' && iina.preferences) {
      iina.preferences.set(this.keys.SERVER, '');
      iina.preferences.set(this.keys.USERNAME, '');
      iina.preferences.set(this.keys.PASSWORD, '');
      iina.preferences.set(this.keys.REMEMBER_ME, 'false');
      Logger.log('[Storage] Configuration cleared');
    }
  }

  /**
   * Get resume position for a stream
   * @param {string} streamId 
   */
  getResumePosition(streamId) {
    if (!state.resumePositions) this.loadHistory(); // Ensure loaded
    return state.resumePositions[String(streamId)] || null;
  }

  /**
   * Save resume position
   * @param {string} streamId 
   * @param {string} type 
   * @param {number} position 
   * @param {number} duration 
   */
  saveResumePosition(streamId, type, position, duration) {
    if (!streamId) return;

    // Ensure state is initialized
    if (!state.resumePositions) state.resumePositions = {};

    state.resumePositions[String(streamId)] = {
      position,
      duration,
      type,
      updatedAt: Date.now()
    };

    // Debounce save to disk could be better, but direct save for now
    this._persistResumePositions();
  }

  /**
   * Load history and resume positions (Async but updates state)
   */
  loadHistory() {
    try {
      if (typeof iina !== 'undefined' && iina.preferences) {
        // History
        const historyData = iina.preferences.get('iptv_history');
        state.history = historyData ? JSON.parse(historyData) : [];
        
        // Resume Positions
        const resumeData = iina.preferences.get('iptv_resume_positions');
        state.resumePositions = resumeData ? JSON.parse(resumeData) : {};
        
        Logger.log(`[Storage] Loaded history (${state.history.length}) and resume positions`);
      }
    } catch (e) {
      Logger.error(`[Storage] Failed to load history: ${e.message}`);
      state.history = [];
      state.resumePositions = {};
    }
  }

  /**
   * Save history to disk
   */
  saveHistory() {
    try {
      if (typeof iina !== 'undefined' && iina.preferences) {
        iina.preferences.set('iptv_history', JSON.stringify(state.history));
      }
    } catch (e) {
      Logger.error(`[Storage] Failed to save history: ${e.message}`);
    }
  }

  /**
   * Add item to history
   * @param {Object} item 
   */
  addToHistory(item) {
    const uniqueKey = item.series_id || item.stream_id || item.id;
    
    // Deduplicate
    state.history = state.history.filter(h => {
      const k = h.series_id || h.stream_id || h.id;
      return k !== uniqueKey;
    });
    
    // Add new
    state.history.unshift({
      id: uniqueKey,
      name: item.name || 'Unknown',
      type: item.type || 'unknown',
      playedAt: Date.now(),
      thumbnail: item.thumbnail || item.stream_icon || '',
      series_id: item.series_id
    });
    
    // Trim
    if (state.history.length > MAX_HISTORY_ITEMS) {
      state.history = state.history.slice(0, MAX_HISTORY_ITEMS);
    }
    
    this.saveHistory();
  }

  _persistResumePositions() {
    try {
      if (typeof iina !== 'undefined' && iina.preferences) {
        iina.preferences.set('iptv_resume_positions', JSON.stringify(state.resumePositions));
      }
    } catch (e) {
      Logger.error(`[Storage] Failed to persist resume positions: ${e.message}`);
    }
  }
}

module.exports = { Storage };
