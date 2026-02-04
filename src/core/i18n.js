/**
 * IINA IPTV Plugin - Internationalization (i18n)
 * @module core/i18n
 *
 * Simple i18n system with FR/EN support
 * Uses shared dictionary from src/core/dictionary.js
 */

'use strict';

const dictionaries = require('./dictionary.js');

// ============================================
// LOCALE STATE
// ============================================

var currentLocale = 'fr';

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Set the current locale
 * @param {string} locale - Locale code ('fr' or 'en')
 */
function setLocale(locale) {
  if (dictionaries[locale]) {
    currentLocale = locale;
    // Persist preference
    try {
      if (typeof iina !== 'undefined' && iina.preferences) {
        iina.preferences.set('iptv_locale', locale);
        iina.preferences.sync();
      }
    } catch (e) {
      // Ignore storage errors
    }
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
 * Get all available locales
 * @returns {string[]} Array of locale codes
 */
function getAvailableLocales() {
  return Object.keys(dictionaries);
}

/**
 * Get the dictionary for a specific locale
 * @param {string} locale - Locale code
 * @returns {Object} Dictionary object
 */
function getDictionary(locale) {
  return dictionaries[locale] || dictionaries.fr;
}

/**
 * Load locale from preferences
 */
function loadLocale() {
  try {
    if (typeof iina !== 'undefined' && iina.preferences) {
      var saved = iina.preferences.get('iptv_locale');
      if (saved && dictionaries[saved]) {
        currentLocale = saved;
      }
    }
  } catch (e) {
    // Ignore errors, keep default
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
 * t('resume.message', {time: '10:30', percent: 45})
 */
function t(key, params) {
  var dict = dictionaries[currentLocale] || dictionaries.fr;
  var text = dict[key] || dictionaries.fr[key] || key;

  if (params) {
    // Replace {param} placeholders
    Object.keys(params).forEach(function(param) {
      var regex = new RegExp('\\{' + param + '\\}', 'g');
      text = text.replace(regex, String(params[param]));
    });
  }

  return text;
}

// Load saved locale on module init
loadLocale();

// ============================================
// EXPORTS
// ============================================

module.exports = {
  t: t,
  setLocale: setLocale,
  getLocale: getLocale,
  getAvailableLocales: getAvailableLocales,
  getDictionary: getDictionary,
  loadLocale: loadLocale,
  dictionaries: dictionaries
};
