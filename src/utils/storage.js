/**
 * Storage Manager
 * Handles persistent storage for plugin data using iina.preferences
 */

export class StorageManager {
  constructor(prefix = 'iptv_') {
    this.prefix = prefix;
  }

  /**
   * Get a value from storage
   */
  get(key, defaultValue = null) {
    try {
      const value = iina.preferences.get(`${this.prefix}${key}`);
      if (value === undefined || value === null) {
        return defaultValue;
      }
      // Try to parse JSON for complex objects
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        return JSON.parse(value);
      }
      return value;
    } catch (error) {
      iina.console.error(`[Storage] Failed to get ${key}: ${error.message}`);
      return defaultValue;
    }
  }

  /**
   * Set a value in storage
   */
  set(key, value) {
    try {
      let storedValue = value;
      if (typeof value === 'object') {
        storedValue = JSON.stringify(value);
      }
      iina.preferences.set(`${this.prefix}${key}`, storedValue);
      return true;
    } catch (error) {
      iina.console.error(`[Storage] Failed to set ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove a value from storage
   */
  remove(key) {
    try {
      iina.preferences.set(`${this.prefix}${key}`, null);
      return true;
    } catch (error) {
      iina.console.error(`[Storage] Failed to remove ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  has(key) {
    const value = iina.preferences.get(`${this.prefix}${key}`);
    return value !== undefined && value !== null;
  }

  /**
   * Get all keys with the prefix
   */
  keys() {
    // Note: iina.preferences doesn't have a keys() method
    // This is a limitation - we track keys manually if needed
    return [];
  }

  /**
   * Clear all storage with prefix
   */
  clear() {
    // Note: Would need to track all keys to implement this properly
    iina.console.warn('[Storage] Clear not fully implemented');
  }
}
