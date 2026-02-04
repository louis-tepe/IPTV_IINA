/**
 * IINA IPTV Plugin - Frontend i18n Module
 * v8.0.0
 * 
 * Translation system for the browser UI
 * Uses the shared i18n-loader which fetches translations from the backend
 * Source of truth: src/core/dictionary.js
 */

'use strict';

const i18nLoader = require('../i18n-loader.js');

/**
 * Translation function with parameter support
 * Delegates to the i18n-loader
 * @param {string} key - Translation key
 * @param {Object} params - Optional parameters for interpolation
 * @returns {string} Translated text
 * 
 * @example
 * t('nav.items', {count: 5})
 * t('series.season', {num: 2})
 */
function t(key, params) {
  return i18nLoader.t(key, params);
}

/**
 * Get the current locale
 * @returns {string} Current locale code
 */
function getLocale() {
  return i18nLoader.getLocale();
}

/**
 * Set the current locale
 * @param {string} locale - Locale code ('fr' or 'en')
 */
function setLocale(locale) {
  i18nLoader.setLocale(locale);
}

/**
 * Check if translations are ready
 * @returns {boolean} True if translations are loaded
 */
function ready() {
  return i18nLoader.ready();
}

/**
 * Register a callback to be called when translations are ready
 * @param {Function} callback - Callback function
 */
function onReady(callback) {
  i18nLoader.onReady(callback);
}

/**
 * Apply translations to all elements with data-i18n attributes
 * @param {HTMLElement} container - Container element to search within (default: document)
 */
function applyTranslations(container) {
  i18nLoader.applyTranslations(container);
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    t: t,
    getLocale: getLocale,
    setLocale: setLocale,
    ready: ready,
    onReady: onReady,
    applyTranslations: applyTranslations
  };
}
