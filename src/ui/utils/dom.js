/**
 * IINA IPTV Plugin - Frontend DOM Utilities
 * v8.0.0
 * 
 * DOM manipulation utilities and element caching
 */

'use strict';

/**
 * Cache DOM elements for performance
 * @returns {Object.<string, HTMLElement>} Cached elements
 */
function cacheElements() {
  const elements = {};
  
  elements.tabs = document.querySelectorAll('.tab');
  elements.list = document.getElementById('list');
  elements.loading = document.getElementById('loading');
  elements.empty = document.getElementById('empty');
  elements.emptyMessage = document.getElementById('empty-message');
  elements.breadcrumb = document.getElementById('breadcrumb');
  elements.breadcrumbTitle = document.getElementById('breadcrumb-title');
  elements.backBtn = document.getElementById('back-btn');
  elements.searchInput = document.getElementById('search-input');
  elements.searchClear = document.getElementById('search-clear');
  elements.refreshBtn = document.getElementById('refresh-btn');
  elements.disconnectBtn = document.getElementById('disconnect-btn');
  elements.serverName = document.getElementById('server-name');
  elements.itemCount = document.getElementById('item-count');
  elements.debugPanel = document.getElementById('debug-panel');
  elements.debugLogs = document.getElementById('debug-logs');
  elements.debugClear = document.getElementById('debug-clear');
  elements.debugToggle = document.getElementById('debug-toggle');
  elements.debugMsgCount = document.getElementById('debug-msg-count');
  elements.debugLastMsg = document.getElementById('debug-last-msg');
  elements.connectionStatus = document.getElementById('connection-status');
  elements.epgModal = document.getElementById('epg-modal');
  elements.epgContent = document.getElementById('epg-content');
  
  return elements;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle view mode switching (Grid vs List/Details)
 * @param {HTMLElement} listEl - List element
 * @param {boolean} isGrid - True for grid view, false for details view
 */
function setViewMode(listEl, isGrid) {
  if (!listEl) return;
  
  if (isGrid) {
    listEl.classList.add('content-grid');
    listEl.classList.remove('content-details');
  } else {
    listEl.classList.remove('content-grid');
    listEl.classList.add('content-details');
  }
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Relative time string
 */
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

/**
 * Format time in seconds to HH:MM:SS
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
 */
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cacheElements,
    escapeHtml,
    setViewMode,
    getRelativeTime,
    formatTime
  };
}