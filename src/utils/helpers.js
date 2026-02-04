/**
 * IINA IPTV Plugin - Utility Helpers
 * @module utils/helpers
 */

'use strict';

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
    if (typeof iina !== 'undefined' && iina.console) {
      iina.console.error('[IPTV] Base64 encode failed: ' + e.message);
    }
    return str;
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
    if (typeof iina !== 'undefined' && iina.console) {
      iina.console.error('[IPTV] Base64 decode failed: ' + e.message);
    }
    return str;
  }
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
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return '';
  var div = { toString: function() { return text; } };
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Central Logger for IPTV Plugin
 * Eliminates code duplication across modules
 */
var Logger = {
  DEBUG: false,
  PREFIX: '[IPTV]',
  
  init: function() {
    try {
      if (typeof iina !== 'undefined' && iina.preferences) {
        this.DEBUG = iina.preferences.get('iptv_debug') === 'true';
      }
    } catch (e) {}
  },
  
  log: function(msg) {
    if (!this.DEBUG) return;
    try {
      if (typeof iina !== 'undefined' && iina.console) {
        iina.console.log(this.PREFIX + ' ' + msg);
      }
    } catch (e) {}
  },
  
  error: function(msg) {
    try {
      if (typeof iina !== 'undefined' && iina.console) {
        iina.console.error(this.PREFIX + ' ERROR: ' + msg);
      }
    } catch (e) {}
  },
  
  warn: function(msg) {
    try {
      if (typeof iina !== 'undefined' && iina.console) {
        iina.console.warn(this.PREFIX + ' WARN: ' + msg);
      }
    } catch (e) {}
  }
};

// Auto-init
Logger.init();

module.exports = {
  base64Encode: base64Encode,
  base64Decode: base64Decode,
  withTimeout: withTimeout,
  escapeHtml: escapeHtml,
  Logger: Logger
};
