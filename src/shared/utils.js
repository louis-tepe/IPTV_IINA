/**
 * Shared Utilities
 * Used by both global/ (plugin backend) and browser/ (UI)
 */

export const LOG_PREFIX = '[IPTV]';
export const PLUGIN_VERSION = '6.2.0'; // Updated version
export const REQUEST_TIMEOUT = 30000;
export const MAX_HISTORY_ITEMS = 50;
export const CACHE_TTL = 300000;

/**
 * Log an informational message
 * @param {string} msg - Message to log
 */
export function log(msg) {
  const m = LOG_PREFIX + ' ' + msg;
  iina.console.log(m);
  if (typeof iina.standaloneWindow !== 'undefined' && iina.standaloneWindow) {
    try {
        iina.standaloneWindow.postMessage('log', m);
    } catch (e) {}
  }
}

/**
 * Log an error message
 * @param {string} msg - Error message to log
 */
export function logError(msg) {
  const m = LOG_PREFIX + ' ERROR: ' + msg;
  iina.console.error(m);
  if (typeof iina.standaloneWindow !== 'undefined' && iina.standaloneWindow) {
    try {
        iina.standaloneWindow.postMessage('log', '❌ ' + m);
    } catch (e) {}
  }
}

/**
 * Custom Base64 encode function for IINA environment
 * btoa() is not available in IINA's JavaScript context
 * @param {string} str - String to encode
 * @returns {string}
 */
export function base64Encode(str) {
  if (!str) return '';
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let encoded = '';
    let c1, c2, c3;
    let i = 0;
    
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
    // Falls back to direct return in case of error, though logging would be better if we imported logs
    iina.console.error('[Base64] Failed to encode: ' + e.message);
    return str; 
  }
}

/**
 * Custom Base64 decode function for IINA environment
 * atob() is not available in IINA's JavaScript context
 * @param {string} str - String to decode
 * @returns {string}
 */
export function base64Decode(str) {
  if (!str) return '';
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;
    
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');
    
    while (i < str.length) {
      let enc1 = chars.indexOf(str.charAt(i++));
      let enc2 = chars.indexOf(str.charAt(i++));
      let enc3 = chars.indexOf(str.charAt(i++));
      let enc4 = chars.indexOf(str.charAt(i++));
      
      let chr1 = (enc1 << 2) | (enc2 >> 4);
      let chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      let chr3 = ((enc3 & 3) << 6) | enc4;
      
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
    iina.console.error('[Base64] Failed to decode: ' + e.message);
    return str; 
  }
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
