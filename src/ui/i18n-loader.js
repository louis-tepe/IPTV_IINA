/**
 * IINA IPTV Plugin - Frontend i18n Loader
 * @module ui/i18n-loader
 * 
 * Loads and caches translations from the backend
 * Provides the t() function to frontend components
 */

'use strict';

// ============================================
// STATE
// ============================================

let currentLocale = 'fr';
let cachedDictionary = null;
let isReady = false;
let readyCallbacks = [];

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Initialize the i18n system by loading translations from backend
 */
function init() {
  if (typeof window !== 'undefined' && window.iina) {
    // Request translations from backend
    window.iina.onMessage('i18n.translations', function(data) {
      if (data && data.dictionary) {
        cachedDictionary = data.dictionary;
        currentLocale = data.locale || 'fr';
        isReady = true;
        
        // Apply translations to DOM
        applyTranslations();
        
        // Notify all waiting callbacks
        readyCallbacks.forEach(function(callback) {
          try {
            callback();
          } catch (e) {
            console.error('Error in i18n ready callback:', e);
          }
        });
        readyCallbacks = [];
      }
    });

    // Request initial translations
    window.iina.postMessage('i18n.getTranslations');
  } else {
    // Fallback for non-IINA environments (testing)
    console.warn('i18n-loader: Not running in IINA environment, using fallback');
    isReady = true;
  }
}

/**
 * Set the current locale
 * @param {string} locale - Locale code ('fr' or 'en')
 */
function setLocale(locale) {
  currentLocale = locale;
  
  // Notify backend of locale change
  if (typeof window !== 'undefined' && window.iina && window.iina.postMessage) {
    window.iina.postMessage('i18n.setLocale', { locale: locale });
  }
  
  // Reload translations
  isReady = false;
  cachedDictionary = null;
  init();
  
  // Apply translations immediately if already ready
  if (isReady && cachedDictionary) {
    applyTranslations();
  }
}

/**
 * Get the current locale
 * @returns {string} Current locale code
 */
function getLocale() {
  return currentLocale;
}

/**
 * Check if translations are ready
 * @returns {boolean} True if translations are loaded
 */
function ready() {
  return isReady;
}

/**
 * Register a callback to be called when translations are ready
 * @param {Function} callback - Callback function
 */
function onReady(callback) {
  if (isReady) {
    // Already ready, call immediately
    try {
      callback();
    } catch (e) {
      console.error('Error in i18n ready callback:', e);
    }
  } else {
    // Wait for translations to load
    readyCallbacks.push(callback);
  }
}

/**
 * Translate a key with optional parameters
 * @param {string} key - Translation key
 * @param {Object} params - Parameters to interpolate
 * @returns {string} Translated string
 * 
 * @example
 * t('nav.items', {count: 5})
 * t('series.season', {num: 2})
 */
function t(key, params) {
  if (!cachedDictionary) {
    // Return the key if translations not loaded yet
    return key;
  }
  
  var dict = cachedDictionary[currentLocale] || cachedDictionary.fr || {};
  var text = dict[key] || key;
  
  if (params) {
    // Replace {param} placeholders
    Object.keys(params).forEach(function(param) {
      var regex = new RegExp('\\{' + param + '\\}', 'g');
      text = text.replace(regex, String(params[param]));
    });
  }
  
  return text;
}

/**
 * Apply translations to all elements with data-i18n attributes
 * This should be called when translations are loaded or locale changes
 * @param {HTMLElement} container - Container element to search within (default: document)
 */
function applyTranslations(container) {
  container = container || document;
  
  if (!cachedDictionary) {
    // Not ready yet, will be called automatically when loaded
    return;
  }
  
  // Apply to elements with data-i18n attribute (text content)
  var elements = container.querySelectorAll('[data-i18n]');
  elements.forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });
  
  // Apply to elements with data-i18n-placeholder attribute (placeholder)
  var placeholders = container.querySelectorAll('[data-i18n-placeholder]');
  placeholders.forEach(function(el) {
    var key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.setAttribute('placeholder', t(key));
    }
  });
  
  // Apply to elements with data-i18n-title attribute (title)
  var titles = container.querySelectorAll('[data-i18n-title]');
  titles.forEach(function(el) {
    var key = el.getAttribute('data-i18n-title');
    if (key) {
      el.setAttribute('title', t(key));
    }
  });
}

// ============================================
// AUTO-INIT
// ============================================

if (typeof window !== 'undefined') {
  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already ready
    init();
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  init: init,
  setLocale: setLocale,
  getLocale: getLocale,
  ready: ready,
  onReady: onReady,
  t: t,
  applyTranslations: applyTranslations
};
