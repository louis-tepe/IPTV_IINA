/**
 * IINA IPTV Plugin - Browser UI Controller
 * v6.2.0-HISTORY-RESUME-PERSISTENCE - File-Based History & Resume Storage
 *
 * Handles all UI interactions and communication with the plugin backend
 *
 * FEATURES:
 * - File-based persistent storage for history and resume positions (survives IINA restarts)
 * - Improved sync frequency (5s) for better resume position accuracy
 * - Fixed history key for episodes (uses series_id to group episodes)
 * - Enhanced episode metadata parsing with better error handling
 * - Complete episode metadata extraction from Xtream API
 * - Displays: thumbnails, descriptions, titles, duration, quality, release date, audio, bitrate, rating
 * - Comprehensive field name fallbacks for maximum compatibility
 * - Event listeners instead of inline onclick handlers
 * - Visible debug panel always shown at bottom
 * - All frontend logs displayed in panel
 * - All messages sent/received logged with colors
 * - Connection status indicator
 * - Message count and timestamp tracking
 * - Clear and minimize controls
 */

'use strict';

// ============================================
// GLOBAL DEBUG PLAY FUNCTION (Minimalist Approach)
// ============================================

/**
 * Global function to play episode - called via inline onclick
 * This is the minimalist approach with maximum debugging
 * @param {string} streamId - Episode stream ID
 * @param {string} ext - File extension
 * @param {string} title - Episode title
 * @param {string} [seriesId] - Parent series ID (for history tracking)
 */
function playEpisodeSimple(streamId, ext, title, seriesId) {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           playEpisodeSimple() CALLED                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('  📥 INPUT PARAMETERS:');
  console.log('     - streamId:', streamId, '(type:', typeof streamId + ')');
  console.log('     - ext:', ext, '(type:', typeof ext + ')');
  console.log('     - title:', title, '(type:', typeof title + ')');
  console.log('     - seriesId:', seriesId, '(type:', typeof seriesId + ')');
  console.log('');
  console.log('  🔍 ENVIRONMENT CHECK:');
  console.log('     - window exists:', typeof window !== 'undefined');
  console.log('     - window.iina exists:', typeof window.iina !== 'undefined');
  console.log('     - iina.postMessage exists:', typeof iina !== 'undefined' && typeof iina.postMessage === 'function');
  console.log('     - document readyState:', document.readyState);
  
  if (!streamId) {
    console.error('❌❌❌ ERROR: streamId is empty or null!');
    console.error('   Cannot proceed without a valid stream ID');
    return;
  }
  
  if (typeof streamId !== 'string' && typeof streamId !== 'number') {
    console.error('❌❌❌ ERROR: streamId has invalid type:', typeof streamId);
    console.error('   Expected string or number, got:', typeof streamId);
    return;
  }
  
  // Normalize streamId to string
  var normalizedStreamId = String(streamId).trim();
  console.log('  📝 Normalized streamId:', normalizedStreamId);
  
  if (window.iina && iina.postMessage) {
    console.log('');
    console.log('  ✅ iina.postMessage is AVAILABLE - proceeding to send message');
    
    // Flag to track if we received a response
    window._playResponseReceived = false;
    window._playStartTime = Date.now();
    
    var messagePayload = {
      id: normalizedStreamId,
      type: 'series',
      ext: ext || 'mp4',
      name: title || 'Unknown Episode',
      directStream: true,
      timestamp: Date.now(),
      source: 'playEpisodeSimple'
    };
    
    // Add series_id if provided (for proper history tracking)
    if (seriesId) {
      messagePayload.series_id = String(seriesId);
      console.log('  📎 Including series_id in payload:', seriesId);
    }
    
    console.log('');
    console.log('  📤 MESSAGE PAYLOAD:');
    console.log('    ', JSON.stringify(messagePayload, null, 4));
    console.log('');
    console.log('  📡 ATTEMPTING to send message "play" to backend...');
    
    try {
      iina.postMessage('play', messagePayload);
      
      var elapsed = Date.now() - window._playStartTime;
      console.log('  ✅✅✅ Message "play" SENT SUCCESSFULLY!');
      console.log('     Time taken:', elapsed, 'ms');
      console.log('');
      console.log('  ⏱️  Starting response timeout timer (2 seconds)...');
      
      // Set timeout to check if response was received after 2 seconds
      setTimeout(function() {
        var totalElapsed = Date.now() - window._playStartTime;
        if (!window._playResponseReceived) {
          console.error('');
          console.error('╔══════════════════════════════════════════════════════════════╗');
          console.error('║  ⚠️  WARNING: NO RESPONSE FROM BACKEND!                      ║');
          console.error('╚══════════════════════════════════════════════════════════════╝');
          console.error('  Time elapsed:', totalElapsed, 'ms');
          console.error('  The play message was sent but the backend did not acknowledge it.');
          console.error('');
          console.error('  Possible causes:');
          console.error('    1. global.js is not running or not loaded');
          console.error('    2. The "play" handler is not registered in global.js');
          console.error('    3. Communication channel is broken');
          console.error('    4. handlePlay() crashed silently');
          console.error('');
        } else {
          console.log('  ✅ Response was received within timeout');
        }
      }, 2000);
      
    } catch (err) {
      console.error('');
      console.error('╔══════════════════════════════════════════════════════════════╗');
      console.error('║  ❌❌❌ CRITICAL ERROR sending message!                       ║');
      console.error('╚══════════════════════════════════════════════════════════════╝');
      console.error('  Error message:', err.message);
      console.error('  Error name:', err.name);
      console.error('  Error stack:', err.stack);
      console.error('');
      throw err;
    }
  } else {
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║  ❌❌❌ CRITICAL: Cannot send message!                        ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    console.error('  window.iina =', window.iina);
    console.error('  iina =', typeof iina !== 'undefined' ? iina : 'undefined');
    console.error('');
    console.error('  Not running inside IINA or iina object not initialized');
  }
  
  console.log('');
  console.log('  <<< playEpisodeSimple() completed >>>');
  console.log('');
}

// Make it globally available
window.playEpisodeSimple = playEpisodeSimple;

// ============================================
// STATE MANAGEMENT
// ============================================

/** @type {BrowserState} */
const state = {
  isConnected: false,
  currentTab: 'live',
  currentCategory: null,
  currentCategoryName: '',
  currentSeriesId: null,  // Track current series ID for episode context
  items: [],
  favorites: {},
  currentRequestId: 0,
  isLoading: false,
  previousView: null,
  currentRequestTimeout: null,  // Track request timeout to prevent infinite loading
  debugMsgCount: 0,
  debugMinimized: false
};

// ============================================
// DOM ELEMENTS CACHE
// ============================================

/** @type {Object.<string, HTMLElement>} */
const elements = {};

/**
 * Cache DOM elements for performance
 */
function cacheElements() {
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
}

/**
 * Handle view mode switching (Grid vs List/Details)
 * @param {boolean} isGrid - True for grid view, false for details view
 */
function setViewMode(isGrid) {
  if (!elements.list) return;
  
  if (isGrid) {
    elements.list.classList.add('content-grid');
    elements.list.classList.remove('content-details');
  } else {
    elements.list.classList.remove('content-grid');
    elements.list.classList.add('content-details');
  }
}

// ============================================
// DEBUGGING
// ============================================

/**
 * Log debug message to console and debug panel
 * @param {string} msg - Message to log
 * @param {string} type - Log type (log, error, warn, info, sent, received)
 */
function debug(msg, type = 'log') {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[IPTV Browser] ${msg}`);
  
  if (elements.debugLogs) {
    const div = document.createElement('div');
    div.className = `debug-log-entry ${type}`;
    div.innerHTML = `<span class="debug-log-timestamp">${timestamp}</span> ${escapeHtml(msg)}`;
    elements.debugLogs.appendChild(div);
    elements.debugLogs.scrollTop = elements.debugLogs.scrollHeight;
    
    // Keep only last 200 messages
    while (elements.debugLogs.children.length > 200) {
      elements.debugLogs.removeChild(elements.debugLogs.firstChild);
    }
    
    // Update stats
    state.debugMsgCount++;
    if (elements.debugMsgCount) {
      elements.debugMsgCount.textContent = `Msgs: ${state.debugMsgCount}`;
    }
    if (elements.debugLastMsg) {
      elements.debugLastMsg.textContent = `Last: ${timestamp}`;
    }
  }
}

// ============================================
// DEBUG PANEL FUNCTIONS
// ============================================

/**
 * Update connection status display
 * @param {string} status - 'connecting', 'connected', or 'error'
 * @param {string} message - Optional status message
 */
function updateConnectionStatus(status, message) {
  if (!elements.connectionStatus) return;
  
  elements.connectionStatus.className = 'connection-status ' + status;
  
  switch (status) {
    case 'connected':
      elements.connectionStatus.textContent = message || '● Connected';
      state.isConnected = true;
      break;
    case 'error':
      elements.connectionStatus.textContent = message || '● Error';
      state.isConnected = false;
      break;
    case 'connecting':
    default:
      elements.connectionStatus.textContent = message || '● Connecting';
      state.isConnected = false;
      break;
  }
}

/**
 * Clear debug logs
 */
function clearDebugLogs() {
  if (elements.debugLogs) {
    elements.debugLogs.innerHTML = '';
    state.debugMsgCount = 0;
    if (elements.debugMsgCount) {
      elements.debugMsgCount.textContent = 'Msgs: 0';
    }
  }
}

/**
 * Toggle debug panel minimized state
 */
function toggleDebugPanel() {
  if (!elements.debugPanel) return;
  
  state.debugMinimized = !state.debugMinimized;
  elements.debugPanel.classList.toggle('minimized', state.debugMinimized);
  
  if (elements.debugToggle) {
    elements.debugToggle.textContent = state.debugMinimized ? '▲' : '▼';
  }
}

/**
 * Setup debug panel event listeners
 */
function setupDebugPanelListeners() {
  if (elements.debugClear) {
    elements.debugClear.addEventListener('click', (e) => {
      e.stopPropagation();
      clearDebugLogs();
      debug('Logs cleared', 'info');
    });
  }
  
  if (elements.debugToggle) {
    elements.debugToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDebugPanel();
    });
  }
  
  // Click header to toggle
  const debugHeader = document.querySelector('.debug-header');
  if (debugHeader) {
    debugHeader.addEventListener('click', (e) => {
      // Don't toggle if clicking buttons
      if (e.target.closest('.debug-btn')) return;
      toggleDebugPanel();
    });
  }
}

/**
 * Wrapper for iina.postMessage that logs all messages
 * @param {string} action - Message action
 * @param {*} data - Message data
 */
function sendMessage(action, data) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  const dataStr = data ? JSON.stringify(data).substring(0, 100) : 'null';
  
  debug(`→ SEND [${action}]: ${dataStr}`, 'sent');
  
  if (window.iina && iina.postMessage) {
    try {
      iina.postMessage(action, data);
      return true;
    } catch (err) {
      debug(`✗ SEND FAILED: ${err.message}`, 'error');
      return false;
    }
  } else {
    debug('✗ SEND FAILED: iina.postMessage not available', 'error');
    updateConnectionStatus('error', '● Not Connected');
    return false;
  }
}

// ============================================
// LOADING & UI STATE
// ============================================

/**
 * Generate unique request ID
 * @returns {number}
 */
function generateRequestId() {
  return ++state.currentRequestId;
}

const MAX_ITEMS_ANIMATION = 50;

/**
 * Show loading skeleton
 */
function showLoading() {
  state.isLoading = true;
  if (elements.loading) elements.loading.hidden = true; // Use skeleton instead
  if (elements.empty) elements.empty.hidden = true;
  
  // Render skeleton grid
  if (elements.list) {
    const skeletonCount = 20;
    let html = '<div class="skeleton-grid">';
    for (let i = 0; i < skeletonCount; i++) {
        html += '<div class="skeleton-card"></div>';
    }
    html += '</div>';
    elements.list.innerHTML = html;
  }
  
  debug('Loading started (Skeleton)');
}

/**
 * Hide loading spinner
 */
function hideLoading() {
  state.isLoading = false;
  if (elements.loading) elements.loading.hidden = true;
  debug('Loading finished');
}

/**
 * Show empty state with message
 * @param {string} message - Message to display
 */
function showEmpty(message) {
  hideLoading();
  if (elements.empty) elements.empty.hidden = false;
  if (elements.emptyMessage) elements.emptyMessage.textContent = message || 'No content available';
  if (elements.list) elements.list.innerHTML = '';
  if (elements.itemCount) elements.itemCount.textContent = '0 items';
}

// ============================================
// RENDERING
// ============================================

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render category cards
 * @param {Array} categories - Categories array
 */
function renderCategories(categories) {
  debug('>>> renderCategories START');
  hideLoading();
  
  if (!categories || !Array.isArray(categories)) {
    debug('ERROR: Invalid categories data received', 'error');
    showEmpty('Invalid response from server');
    return;
  }
  
  if (categories.length === 0) {
    debug('No categories to render');
    showEmpty('No categories found');
    return;
  }
  
  debug('Rendering ' + categories.length + ' categories');
  
  if (elements.empty) elements.empty.hidden = true;
  
  // Use category-grid class for the list container
  if (elements.list) {
    elements.list.className = 'category-grid';
  }
  
  const fragment = document.createDocumentFragment();
  
  categories.forEach((cat, index) => {
    if (!cat) return;
    
    const id = cat.category_id || cat.id;
    const name = escapeHtml(cat.category_name || cat.name || 'Unknown');
    
    if (!id) return;
    
    const card = document.createElement('div');
    card.className = 'category-card';
    card.setAttribute('data-id', id);
    
    // Choose icon based on category name
    let iconPath = 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'; // Default Folder
    
    // Simple keyword matching for better icons
    const nameLower = name.toLowerCase();
    if (nameLower.includes('movie') || nameLower.includes('film') || nameLower.includes('vod')) {
      iconPath = 'M19.82 2H4.18C2.97 2 2 2.97 2 4.18v15.64C2 21.03 2.97 22 4.18 22h15.64c1.21 0 2.18-.97 2.18-2.18V4.18C22 2.97 21.03 2 19.82 2zM7 2v20M17 2v20M2 12h5M2 7h5M2 17h5M17 17h5M17 7h5M17 12h5'; // Film strip
    } else if (nameLower.includes('series') || nameLower.includes('show') || nameLower.includes('tv')) {
      iconPath = 'M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z'; // TV
    } else if (nameLower.includes('sport') || nameLower.includes('foot') || nameLower.includes('soccer')) {
      iconPath = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z'; // Sport/Globe
    } else if (nameLower.includes('kid') || nameLower.includes('enfant') || nameLower.includes('cartoon') || nameLower.includes('anime')) {
      iconPath = 'M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z'; // Child/Happy
    }
    
    card.innerHTML = `
      <div class="category-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="${iconPath}"/>
        </svg>
      </div>
      <div class="category-info">
        <div class="category-name">${name}</div>
        <div class="category-count">Open</div>
      </div>
    `;
    
    card.addEventListener('click', () => loadCategory(id, name));
    
    // Staggered animation delay
    if (index < MAX_ITEMS_ANIMATION) {
      card.style.animationDelay = `${index * 0.05}s`;
    }
    
    fragment.appendChild(card);
  });
  
  if (elements.list) {
    elements.list.innerHTML = '';
    elements.list.appendChild(fragment);
  }
  
  if (elements.itemCount) {
    elements.itemCount.textContent = `${categories.length} categories`;
  }
  
  debug(`Rendered ${categories.length} categories (Grid Mode)`);
}

/**
 * Render stream cards
 * @param {Array} list - Items array
 * @param {string} type - Content type
 */
function renderItems(list, type) {
  debug('>>> renderItems START - type: ' + type);
  hideLoading();
  
  // Reset to grid view for normal content (not history)
  if (type !== 'history' && elements.list) {
    elements.list.className = 'content-grid';
  }
  
  setViewMode(true);
  
  if (!list || !Array.isArray(list)) {
    debug('ERROR: Invalid items data received', 'error');
    showEmpty('Invalid response from server');
    return;
  }
  
  state.items = list;
  
  if (list.length === 0) {
    debug('No items to render');
    showEmpty('No content found');
    return;
  }
  
  debug('Rendering ' + list.length + ' items of type: ' + type);
  
  if (elements.empty) elements.empty.hidden = true;
  
  // Issue 2: Use enhanced history rendering for history type
  if (type === 'history') {
    renderHistoryItems(list);
    return;
  }
  
  const fragment = document.createDocumentFragment();
  
  list.forEach((item, index) => {
    if (!item) return;
    
    const name = escapeHtml(item.name || item.title || 'Unknown');
    const id = item.stream_id || item.series_id || index;
    const ext = item.container_extension || 'ts';
    const poster = item.stream_icon || item.cover || '';
    const isFav = state.favorites[id] ? 'active' : '';
    const isLive = type === 'live';
    const searchType = item.searchType || type;
    
    const card = document.createElement('div');
    card.className = 'stream-card';
    card.setAttribute('data-id', id);
    card.setAttribute('data-ext', ext);
    card.setAttribute('data-name', name);
    card.setAttribute('data-type', searchType);
    
    let posterHtml;
    if (poster) {
      posterHtml = `<img src="${poster}" alt="" loading="lazy" onerror="this.style.display='none'">`;
    } else {
      posterHtml = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="2" y="2" width="20" height="20" rx="2"/>
          <circle cx="12" cy="12" r="4"/>
        </svg>
      `;
    }
    
    card.innerHTML = `
      <div class="stream-poster">
        ${posterHtml}
        ${isLive ? '<span class="stream-live-badge">Live</span>' : ''}
        <button class="stream-favorite ${isFav}" data-id="${id}" aria-label="Toggle favorite">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        ${isLive ? `<button class="stream-epg-btn" data-id="${id}" title="Program Guide">EPG</button>` : ''}
      </div>
      <div class="stream-info">
        <div class="stream-name">${name}</div>
        ${item.rating ? `<div class="stream-meta">★ ${item.rating}</div>` : ''}
        ${item.searchType ? `<div class="stream-type-badge">${item.searchType.toUpperCase()}</div>` : ''}
      </div>
    `;
    
    // Click to play
    card.addEventListener('click', (e) => {
      if (e.target.closest('.stream-favorite') || e.target.closest('.stream-epg-btn')) return;
      
      // If it's a series, load series info instead of playing
      if (searchType === 'series') {
        loadSeriesInfo(id, name);
      } else {
        playStream(id, ext, name, searchType);
      }
    });
    
    // Favorite toggle
    const favBtn = card.querySelector('.stream-favorite');
    if (favBtn) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(id, name, searchType, favBtn);
      });
    }
    
    // EPG button
    const epgBtn = card.querySelector('.stream-epg-btn');
    if (epgBtn) {
      epgBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showEpg(id, name);
      });
    }
    
    fragment.appendChild(card);
  });
  
  if (elements.list) {
    elements.list.innerHTML = '';
    elements.list.appendChild(fragment);
  }
  
  if (elements.itemCount) {
    elements.itemCount.textContent = `${list.length} items`;
  }
  
  debug(`Rendered ${list.length} items`);
}

/**
 * Issue 2: Enhanced history rendering with thumbnails and timestamps
 * @param {Array} historyItems - History items array
 */
function renderHistoryItems(historyItems) {
  debug('>>> renderHistoryItems START');
  
  if (elements.empty) elements.empty.hidden = true;
  
  // Apply history view class for proper styling
  if (elements.list) {
    elements.list.className = 'history-view';
  }
  
  const fragment = document.createDocumentFragment();
  
  historyItems.forEach((item, index) => {
    if (!item) return;
    
    const name = escapeHtml(item.name || 'Unknown');
    const id = item.id || item.stream_id || item.series_id || index;
    const ext = item.container_extension || 'ts';
    const type = item.type || 'unknown';
    const thumbnail = item.thumbnail || item.stream_icon || item.cover || '';
    const playedAt = item.playedAt || Date.now();
    
    // Format timestamp
    const date = new Date(playedAt);
    const timeStr = date.toLocaleString();
    const relativeTime = getRelativeTime(playedAt);
    
    const card = document.createElement('div');
    card.className = 'history-card';
    card.setAttribute('data-id', id);
    card.setAttribute('data-ext', ext);
    card.setAttribute('data-name', name);
    card.setAttribute('data-type', type);
    
    let thumbnailHtml;
    if (thumbnail) {
      thumbnailHtml = `<img src="${thumbnail}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
    } else {
      thumbnailHtml = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="2" y="2" width="20" height="20" rx="2"/>
          <circle cx="12" cy="12" r="4"/>
        </svg>
      `;
    }
    
    card.innerHTML = `
      <div class="history-thumbnail">
        ${thumbnailHtml}
        <div class="history-thumbnail-placeholder" style="${thumbnail ? 'display:none;' : ''}">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="2" y="2" width="20" height="20" rx="2"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
        </div>
      </div>
      <div class="history-info">
        <div class="history-title">${name}</div>
        <div class="history-meta">
          <span class="history-type-badge">${type.toUpperCase()}</span>
          <span class="history-timestamp">${relativeTime}</span>
        </div>
        <div class="history-timestamp" title="${timeStr}">${timeStr}</div>
      </div>
    `;
    
    // Click to play - CRITICAL FIX: Use series_id if available for episodes
    card.addEventListener('click', () => {
      if (type === 'series') {
        // If this history item has a series_id, use it to load series info
        // This happens when an episode was played and we stored the parent series_id
        if (item.series_id) {
          debug(`[History] Loading series info with stored series_id: ${item.series_id}`);
          loadSeriesInfo(item.series_id, name);
        } else {
          // This is a series entry itself (not an episode)
          loadSeriesInfo(id, name);
        }
      } else {
        // For live/vod streams, play directly
        playStream(id, ext, name, type);
      }
    });
    
    fragment.appendChild(card);
  });
  
  if (elements.list) {
    elements.list.innerHTML = '';
    elements.list.appendChild(fragment);
  }
  
  if (elements.itemCount) {
    elements.itemCount.textContent = `${historyItems.length} items`;
  }
  
  debug(`Rendered ${historyItems.length} history items`);
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {number} timestamp - Unix timestamp
 * @returns {string}
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
 * Issue 3: Format time in seconds to HH:MM:SS
 * @param {number} seconds - Time in seconds
 * @returns {string}
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

/**
 * Show EPG modal
 * @param {string} streamId - Stream ID
 * @param {string} streamName - Stream name
 */
function showEpg(streamId, streamName) {
  debug('>>> showEpg CALLED');
  debug('  streamId: ' + streamId);
  debug('  streamName: ' + streamName);
  
  if (!elements.epgModal || !elements.epgContent) {
    debug('ERROR: EPG modal elements not found', 'error');
    return;
  }
  
  elements.epgContent.innerHTML = `
    <div class="epg-loading">
      <div class="spinner"></div>
      <p>Loading program guide...</p>
    </div>
  `;
  elements.epgModal.hidden = false;
  
  // Request EPG data from plugin
  debug('Requesting EPG data from backend');
  sendMessage('getEpg', { streamId: streamId });
  
  // Store current stream name for display
  elements.epgModal.setAttribute('data-stream-name', streamName);
  
  debug('<<< showEpg END');
}

/**
 * Render EPG data
 * @param {Object} data - EPG data
 */
function renderEpg(data) {
  debug('>>> renderEpg START');
  
  if (!elements.epgContent) {
    debug('ERROR: EPG content element not found', 'error');
    return;
  }
  
  const streamName = elements.epgModal ? elements.epgModal.getAttribute('data-stream-name') : '';
  
  if (!data || data.error) {
    debug('ERROR: Failed to render EPG - ' + (data ? data.error : 'Unknown error'), 'error');
    elements.epgContent.innerHTML = `
      <div class="epg-error">
        <p>Failed to load program guide</p>
        <p class="epg-error-detail">${data ? data.error : 'Unknown error'}</p>
      </div>
    `;
    return;
  }
  
  const programs = data.data || [];
  
  if (!Array.isArray(programs) || programs.length === 0) {
    elements.epgContent.innerHTML = `
      <div class="epg-empty">
        <p>No program information available</p>
      </div>
    `;
    return;
  }
  
  let html = `<h3>${escapeHtml(streamName)}</h3><div class="epg-list">`;
  
  programs.forEach(program => {
    const title = escapeHtml(program.title || program.name || 'Unknown Program');
    const description = escapeHtml(program.description || program.plot || '');
    const startTime = program.start || '';
    const endTime = program.end || '';
    
    html += `
      <div class="epg-item">
        <div class="epg-time">${startTime} - ${endTime}</div>
        <div class="epg-title">${title}</div>
        ${description ? `<div class="epg-desc">${description}</div>` : ''}
      </div>
    `;
  });
  
  html += '</div>';
  elements.epgContent.innerHTML = html;
  
  debug('✓ EPG rendered: ' + programs.length + ' programs');
  debug('<<< renderEpg END');
}

// ============================================
// ACTIONS
// ============================================

/**
 * Load category contents
 * @param {string} catId - Category ID
 * @param {string} catName - Category name
 */
function loadCategory(catId, catName) {
  debug('>>> loadCategory CALLED');
  debug('  catId: ' + catId);
  debug('  catName: ' + catName);
  debug('  currentTab: ' + state.currentTab);
  
  state.currentCategory = catId;
  state.currentCategoryName = catName;
  
  if (elements.breadcrumb) elements.breadcrumb.hidden = false;
  if (elements.breadcrumbTitle) elements.breadcrumbTitle.textContent = catName;
  if (elements.list) elements.list.innerHTML = '';
  
  showLoading();
  
  debug('Requesting streams for category: ' + catId);
  if (!sendMessage('load', { type: state.currentTab, category: catId })) {
    hideLoading();
    showEmpty('Plugin error: Cannot communicate with IINA');
  }
  
  debug('<<< loadCategory END');
}

/**
 * Load content for current tab
 * @param {string} type - Content type
 */
function loadContent(type) {
  debug('>>> loadContent CALLED');
  debug('  type: ' + type);
  debug('  isConnected: ' + state.isConnected);
  
  state.currentTab = type;
  state.currentCategory = null;
  state.currentCategoryName = '';
  
  if (elements.breadcrumb) elements.breadcrumb.hidden = true;
  if (elements.list) elements.list.innerHTML = '';
  
  // Update active tab
  elements.tabs.forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-type') === type);
  });
  
  showLoading();
  
  debug('Requesting content for tab: ' + type);
  if (!sendMessage('load', { type: type })) {
    hideLoading();
    showEmpty('Plugin error: Cannot communicate with IINA');
  }
  
  debug('<<< loadContent END');
}

/**
 * Play a stream
 * @param {string} id - Stream ID
 * @param {string} ext - File extension
 * @param {string} name - Stream name
 * @param {string} type - Stream type
 */
function playStream(id, ext, name, type) {
  debug('>>> playStream CALLED');
  
  if (!id) {
    debug('ERROR: Cannot play - missing stream ID', 'error');
    return;
  }
  
  debug('Playing stream:');
  debug('  id: ' + id);
  debug('  name: ' + name);
  debug('  type: ' + (type || state.currentTab));
  debug('  ext: ' + ext);
  
  // Issue 3: Check for resume position before playing
  sendMessage('getResumePosition', { streamId: id });
  
  // Store play info for resume callback
  window._pendingPlay = { id, ext, name, type: type || state.currentTab };
  
  // Wait for resume position response before playing
  // The actual play will be triggered by the resumePosition handler
  setTimeout(() => {
    // If no resume response after 500ms, play normally
    if (window._pendingPlay && window._pendingPlay.id === id) {
      debug('No resume position received, playing from beginning');
      sendMessage('play', { 
        id: id, 
        ext: ext, 
        name: name,
        type: type || state.currentTab 
      });
      window._pendingPlay = null;
    }
  }, 500);
  
  debug('<<< playStream END');
}

/**
 * Load series information (seasons and episodes)
 * @param {string} seriesId - Series ID
 * @param {string} seriesName - Series name
 */
function loadSeriesInfo(seriesId, seriesName) {
  debug('>>> loadSeriesInfo START');
  debug('  seriesId: ' + seriesId);
  debug('  seriesName: ' + seriesName);
  
  showLoading();
  debug('Loading shown');
  
  // Clear any existing timeout
  if (state.currentRequestTimeout) {
    clearTimeout(state.currentRequestTimeout);
    state.currentRequestTimeout = null;
  }
  
  // Store current view state for back navigation
  state.previousView = {
    category: state.currentCategory,
    categoryName: state.currentCategoryName,
    items: state.items,
    tab: state.currentTab
  };
  debug('Previous view state saved');
  
  // Set a timeout to prevent infinite loading (15 seconds)
  state.currentRequestTimeout = setTimeout(() => {
    debug('ERROR: loadSeriesInfo timeout - no response from backend after 15s');
    hideLoading();
    showEmpty('Request timeout: No response from server. Please try again.');
    state.currentRequestTimeout = null;
  }, 15000);
  
  debug('Sending loadSeriesInfo message to backend...');
  if (!sendMessage('loadSeriesInfo', { seriesId, seriesName })) {
    // Clear timeout on error
    if (state.currentRequestTimeout) {
      clearTimeout(state.currentRequestTimeout);
      state.currentRequestTimeout = null;
    }
    hideLoading();
    showEmpty('Plugin error: Cannot communicate with IINA');
  } else {
    debug('loadSeriesInfo message sent successfully');
  }
  
  debug('<<< loadSeriesInfo END');
}

/**
 * Play a series episode (legacy function, kept for compatibility)
 * @param {string} streamId - Stream ID
 * @param {string} ext - File extension
 * @param {string} title - Episode title
 */
function playEpisode(streamId, ext, title) {
  // Delegate to the new simple function
  playEpisodeSimple(streamId, ext, title);
}

/**
 * Render series details with seasons and episodes
 * @param {Object} data - Series data with seasons and episodes
 */
function renderSeriesDetails(data) {
  hideLoading();
  setViewMode(false);
  
  // Validate data
  if (!data) {
    debug('ERROR: No data received in renderSeriesDetails');
    showEmpty('No series information received');
    return;
  }
  
  debug('renderSeriesDetails called with data: ' + JSON.stringify({
    hasData: !!data,
    dataType: typeof data,
    hasSeasons: data && !!data.seasons,
    seasonsType: data && data.seasons ? typeof data.seasons : 'N/A',
    isSeasonsArray: data && data.seasons ? Array.isArray(data.seasons) : false,
    seasonsKeys: data && data.seasons ? Object.keys(data.seasons) : 'N/A',
    name: data && data.name,
    seriesId: data && data.seriesId
  }));
  
  // Ensure seasons exists (even if empty)
  if (!data.seasons) {
    debug('WARNING: No seasons property, creating empty object');
    data.seasons = {};
  }
  
  const { seriesId, name, cover, plot, seasons } = data;
  
  // CRITICAL FIX: Set current series ID in state for episode context
  if (seriesId) {
    state.currentSeriesId = seriesId;
    debug(`[Series] Set currentSeriesId: ${seriesId}`);
  }
  
  debug('Extracted seasons: type=' + typeof seasons + ', isArray=' + Array.isArray(seasons) + ', keys=' + Object.keys(seasons).join(','));
  
  // Convert object format (API response) to array format (UI expected)
  let seasonsArray = seasons;
  if (!Array.isArray(seasons) && typeof seasons === 'object' && seasons !== null) {
    debug('Converting seasons object to array format');
    seasonsArray = Object.keys(seasons).map(key => ({
      season_number: parseInt(key, 10),
      num: parseInt(key, 10),
      episodes: seasons[key]
    })).sort((a, b) => a.season_number - b.season_number);
    debug('Converted to ' + seasonsArray.length + ' seasons');
  }
  
  // Use the converted array
  const finalSeasons = Array.isArray(seasonsArray) ? seasonsArray : [];
  
  if (elements.empty) elements.empty.hidden = true;
  
  // Clear the list
  if (elements.list) elements.list.innerHTML = '';
  
  // PREMIUM UX: Hide default breadcrumb bar for immersive experience
  if (elements.breadcrumb) elements.breadcrumb.hidden = true;
  if (elements.breadcrumbTitle) elements.breadcrumbTitle.textContent = name || 'Series Details';
  
  // Create series details container
  const container = document.createElement('div');
  container.className = 'series-details-container';
  
  // Use backdrop if available, otherwise cover, otherwise fallback
  const backdropUrl = data.backdrop_path || data.backdrop || data.background || cover || '';
  
  // Series header with immersive background
  const headerHtml = `
    <div class="series-header" style="background-image: url('${escapeHtml(backdropUrl)}');">
      <!-- Floating Back Button -->
      <button class="btn-hero-back" id="hero-back-btn" aria-label="Retour">
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <line x1="19" y1="12" x2="5" y2="12"></line>
             <polyline points="12 19 5 12 12 5"></polyline>
         </svg>
      </button>

      <div class="series-header-content">
        <div class="series-poster">
          ${cover 
            ? `<img src="${cover}" alt="${escapeHtml(name || '')}" onerror="this.style.display='none';">`
            : `<div class="series-poster-placeholder">
                 <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                   <rect x="2" y="2" width="20" height="20" rx="2"/>
                   <circle cx="12" cy="12" r="4"/>
                 </svg>
               </div>`
          }
        </div>
        <div class="series-info">
          <h2 class="series-title">${escapeHtml(name || 'Unknown Series')}</h2>
          
          <div class="series-meta-row">
            ${data.rating ? `<div class="series-rating">★ ${data.rating}</div>` : ''}
            ${data.releaseDate ? `<div class="series-year">${data.releaseDate.split('-')[0]}</div>` : ''}
            ${finalSeasons.length > 0 ? `<div>${finalSeasons.length} Saison${finalSeasons.length > 1 ? 's' : ''}</div>` : ''}
          </div>
          
          ${plot ? `<p class="series-plot">${escapeHtml(plot)}</p>` : ''}
          
          <div class="series-actions">
            <button class="btn-hero btn-hero-play" id="hero-play-btn">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Commencer la série
            </button>
            <!-- Add logic for Resume button if needed later -->
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Seasons selector
  let seasonsHtml = '<div class="seasons-section"><div class="seasons-header"><h3>Saisons</h3></div><div class="seasons-selector"><div class="seasons-list">';
  
  if (finalSeasons.length === 0) {
    seasonsHtml += '<p class="no-seasons">Aucune saison disponible</p>';
  } else {
    finalSeasons.forEach((season, index) => {
      const seasonNum = season.season_number || season.num || (index + 1);
      const isActive = index === 0 ? 'active' : '';
      seasonsHtml += `
        <button class="season-btn ${isActive}" data-season-index="${index}" data-season-num="${seasonNum}">
          Saison ${seasonNum}
        </button>
      `;
    });
  }
  
  seasonsHtml += '</div></div></div>';
  
  // Episodes container
  const episodesHtml = '<div class="episodes-container"><h3>Épisodes</h3><div class="episodes-list"></div></div>';
  
  container.innerHTML = headerHtml + seasonsHtml + episodesHtml;
  
  if (elements.list) {
    elements.list.appendChild(container);
  }
  
  // Update item count logic if needed, or hide it as it's less relevant in this view
  if (elements.itemCount) {
    elements.itemCount.textContent = `${finalSeasons.length} Saison${finalSeasons.length > 1 ? 's' : ''}`;
  }
  
  // Render episodes for the first season
  if (finalSeasons.length > 0) {
    debug('Rendering episodes for first season: ' + JSON.stringify({
      hasEpisodes: !!finalSeasons[0].episodes,
      episodeCount: finalSeasons[0].episodes ? finalSeasons[0].episodes.length : 0
    }));
    renderEpisodesList(finalSeasons[0].episodes || [], cover);
  } else {
    // No seasons available, show empty episodes
    debug('No seasons available, rendering empty episodes list');
    renderEpisodesList([], cover);
  }
  
  // Add event listeners to season buttons
  const seasonButtons = container.querySelectorAll('.season-btn');
  seasonButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      seasonButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Get season index and render episodes
      const seasonIndex = parseInt(btn.getAttribute('data-season-index'), 10);
      const season = finalSeasons[seasonIndex];
      debug('Season button clicked, index=' + seasonIndex + ', season=' + (season ? 'found' : 'null'));
      if (season && season.episodes) {
        renderEpisodesList(season.episodes, cover);
      }
    });
  });
  
  // Add event listener to Hero Play Button
  const heroPlayBtn = container.querySelector('#hero-play-btn');
  if (heroPlayBtn) {
    if (finalSeasons.length > 0 && finalSeasons[0].episodes && finalSeasons[0].episodes.length > 0) {
      heroPlayBtn.addEventListener('click', () => {
        const firstEp = finalSeasons[0].episodes[0];
        const streamId = firstEp.id || firstEp.stream_id || firstEp.episode_id;
        const ext = firstEp.container_extension || 'mp4';
        const title = firstEp.title || (firstEp.episode_num ? `Épisode ${firstEp.episode_num}` : 'Épisode 1');
        
        debug(`Hero Play button clicked: Playing first episode ${streamId}`, 'info');
        // Pass the series_id when playing from hero button
        playEpisodeSimple(streamId, ext, title, seriesId);
      });
    } else {
      // Disable button if no episodes
      heroPlayBtn.style.opacity = '0.5';
      heroPlayBtn.style.cursor = 'not-allowed';
      heroPlayBtn.title = 'Aucun épisode disponible';
    }
  }

  // Add event listener to Hero Back Button
  const heroBackBtn = container.querySelector('#hero-back-btn');
  if (heroBackBtn) {
    heroBackBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent bubbling
      debug('Hero Back Button clicked', 'info');
      goBack();
    });
  }
  
  debug(`Rendered series details: ${name} with ${finalSeasons.length} seasons`);
}

/**
 * Parse episode.info field - handles both JSON string and object formats
 * ENHANCED: Better error handling and more robust JSON parsing
 * @param {Object} episode - Episode data from API
 * @returns {Object|null} Parsed episode info or null
 */
function parseEpisodeInfo(episode) {
  if (!episode.info) {
    debug(`parseEpisodeInfo: No info field for episode ${episode.id || 'unknown'}`, 'warn');
    return null;
  }
  
  let episodeInfo = null;
  
  if (typeof episode.info === 'string') {
    try {
      // Clean up common JSON encoding issues
      let cleaned = episode.info;
      
      // Handle escaped quotes and special characters
      cleaned = cleaned
        .replace(/\\"/g, '"')        // Unescape escaped quotes
        .replace(/\\n/g, ' ')         // Replace escaped newlines
        .replace(/\\t/g, ' ')         // Replace escaped tabs
        .replace(/\\r/g, '')          // Remove carriage returns
        .trim();
      
      // Try parsing the cleaned string
      episodeInfo = JSON.parse(cleaned);
      debug(`parseEpisodeInfo: ✓ Successfully parsed JSON string for episode ${episode.id}`, 'info');
      
      // Log the parsed keys for debugging
      if (episodeInfo) {
        debug(`parseEpisodeInfo: Parsed keys: ${Object.keys(episodeInfo).join(', ')}`, 'info');
      }
    } catch (e) {
      debug(`parseEpisodeInfo: ✗ JSON parse failed for episode ${episode.id} - ${e.message}`, 'error');
      debug(`parseEpisodeInfo: Raw info value (first 300 chars): ${episode.info.substring(0, 300)}`, 'error');
      
      // Try a more aggressive cleanup as fallback
      try {
        // Remove all non-printable characters except common whitespace
        let aggressiveClean = episode.info.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
        episodeInfo = JSON.parse(aggressiveClean);
        debug(`parseEpisodeInfo: ✓ Aggressive cleanup succeeded for episode ${episode.id}`, 'info');
      } catch (e2) {
        debug(`parseEpisodeInfo: ✗ All parsing attempts failed for episode ${episode.id}`, 'error');
        debug(`parseEpisodeInfo: Error details: ${e2.message}`, 'error');
        episodeInfo = null;
      }
    }
  } else if (typeof episode.info === 'object' && episode.info !== null) {
    episodeInfo = episode.info;
    debug(`parseEpisodeInfo: ✓ info is already an object for episode ${episode.id}`, 'info');
    debug(`parseEpisodeInfo: Object keys: ${Object.keys(episodeInfo).join(', ')}`, 'info');
  } else {
    debug(`parseEpisodeInfo: ✗ info has unexpected type: ${typeof episode.info}`, 'warn');
  }
  
  return episodeInfo;
}

/**
 * Extract episode metadata with comprehensive fallback chain
 * ENHANCED: More field options and better null handling
 * @param {Object} episode - Episode data from API
 * @param {Object|null} episodeInfo - Parsed episode.info object
 * @returns {Object} Extracted metadata
 */
function extractEpisodeMetadata(episode, episodeInfo) {
  // Thumbnail extraction - Xtream API common fields in priority order
  // API returns: movie_image, cover, backdrop, poster_path, backdrop_path
  const thumbnail = episodeInfo?.movie_image ||        // Most common for episode stills
                    episodeInfo?.cover_big ||           // Large cover
                    episodeInfo?.cover ||               // Standard cover
                    episodeInfo?.poster ||              // Poster image
                    episodeInfo?.thumbnail ||           // Thumbnail
                    episodeInfo?.backdrop ||            // Backdrop image
                    episodeInfo?.backdrop_path ||       // TMDB backdrop
                    episodeInfo?.poster_path ||         // TMDB poster
                    episodeInfo?.stream_icon ||         // Stream icon
                    episodeInfo?.fanart ||              // Fanart
                    episodeInfo?.logo ||                // Logo
                    episodeInfo?.banner ||              // Banner
                    episode.movie_image ||              // Direct fields
                    episode.cover ||
                    episode.poster ||
                    episode.thumbnail ||
                    episode.stream_icon ||
                    episode.backdrop ||
                    '';  // Empty fallback

  // Description/plot extraction
  // API returns: plot, overview, description, summary, synopsis
  const plot = episodeInfo?.plot ||                   // Most common
              episodeInfo?.overview ||                // Alternative
              episodeInfo?.description ||             // Another alternative
              episodeInfo?.summary ||                 // Yet another
              episodeInfo?.synopsis ||                // Another variant
              episode.plot ||
              episode.overview ||
              episode.description ||
              episode.summary ||
              '';

  // Duration extraction
  // API returns: duration_secs (seconds), duration (formatted), runtime, length
  const duration = episodeInfo?.duration_secs ||       // Seconds (preferred)
                   episodeInfo?.duration ||            // Formatted string
                   episodeInfo?.runtime ||             // Alternative
                   episodeInfo?.length ||              // Another
                   episodeInfo?.duration_mins ||       // Minutes
                   episode.duration ||
                   episode.runtime ||
                   episode.length ||
                   '';

  // Quality extraction
  // API returns: video, video_quality, quality, resolution, rating, bitrate
  let qualityRaw = episodeInfo?.video ||                // Video quality info
                   episodeInfo?.video_quality ||       // Explicit quality
                   episodeInfo?.quality ||             // Generic quality
                   episodeInfo?.resolution ||          // Resolution
                   episodeInfo?.rating ||              // Rating as quality
                   episodeInfo?.bitrate ||             // Bitrate
                   episodeInfo?.quality_type ||        // Quality type
                   episode.quality ||
                   episode.video_quality ||
                   episode.resolution ||
                   '';
  
  // SANITIZATION: Fix for [object Object] bug
  let quality = '';
  if (typeof qualityRaw === 'object' && qualityRaw !== null) {
      // Try to extract useful info if it's an object
      // Some providers return { width: 1920, height: 1080, ... }
      if (qualityRaw.height) {
          quality = qualityRaw.height + 'p';
      } else if (qualityRaw.name) {
          quality = String(qualityRaw.name);
      } else if (qualityRaw.id) {
          // Sometimes it's just an ID wrapper
          quality = ''; 
      } else if (qualityRaw.width && qualityRaw.height) {
          // Extract resolution from width/height
          quality = qualityRaw.height + 'p';
      } else {
          // If we can't make sense of it, ignore it rather than showing [object Object]
          quality = '';
      }
  } else {
      quality = String(qualityRaw || '');
  }

  // Additional metadata: releasedate, tmdb_id, audio, bitrate
  const releasedate = episodeInfo?.releasedate || 
                      episodeInfo?.release_date ||
                      episodeInfo?.air_date ||
                      episode.releasedate ||
                      '';
  
  const tmdbId = episodeInfo?.tmdb_id || 
                 episodeInfo?.tmdbId ||
                 episodeInfo?.id_tmdb ||
                 '';
  
  const audio = episodeInfo?.audio || 
                episodeInfo?.audio_language ||
                episodeInfo?.audio_codec ||
                '';
  
  const bitrate = episodeInfo?.bitrate || 
                  episodeInfo?.bit_rate ||
                  '';

  // Rating/Score extraction
  const rating = episodeInfo?.rating || 
                 episodeInfo?.vote_average ||
                 episodeInfo?.score ||
                 episodeInfo?.rating_5stars ||
                 '';

  return { thumbnail, plot, duration, quality, releasedate, tmdbId, audio, bitrate, rating };
}

/**
 * Render episodes list for a season - ENHANCED VERSION
 * @param {Array} episodes - Episodes array
 * @param {string} [seriesCover] - Series cover image URL to use as fallback
 */
function renderEpisodesList(episodes, seriesCover) {
  const episodesList = document.querySelector('.episodes-list');
  if (!episodesList) {
    debug('ERROR: episodesList element not found in DOM');
    return;
  }
  
  episodesList.innerHTML = '';
  
  if (!episodes || episodes.length === 0) {
    debug('WARNING: No episodes to render');
    episodesList.innerHTML = '<p class="no-episodes">Aucun épisode disponible</p>';
    return;
  }
  
  // Animation: Trigger fade-in
  episodesList.classList.remove('animate-fade-in');
  void episodesList.offsetWidth; // Force reflow
  episodesList.classList.add('animate-fade-in');
  
  debug(`renderEpisodesList: Starting to render ${episodes.length} episodes`, 'info');
  debug(`renderEpisodesList: Series cover provided: ${seriesCover ? 'YES' : 'NO'}`, 'info');
  
  const fragment = document.createDocumentFragment();
  let renderedCount = 0;
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  episodes.forEach((episode, index) => {
    const epNum = episode.episode_num || episode.num || (index + 1);
    const title = episode.title || `Épisode ${epNum}`;
    // Xtream API uses 'id' for episodes, not 'stream_id'
    const streamId = episode.id || episode.stream_id || episode.episode_id;
    const ext = episode.container_extension || 'mp4';
    
    // Validate stream ID
    if (!streamId) {
      debug(`Episode ${index + 1}: SKIPPED - No valid ID (id=${episode.id}, stream_id=${episode.stream_id}, episode_id=${episode.episode_id})`, 'warn');
      skipCount++;
      return;
    }
    
    debug(`════════════════════════════════════════════════════════════`, 'info');
    debug(`Episode ${index + 1}: "${title}" (ID: ${streamId})`, 'info');
    debug(`  Raw keys: ${Object.keys(episode).join(', ')}`, 'info');
    debug(`  info type: ${typeof episode.info}`, 'info');
    debug(`  info value (first 200 chars): ${episode.info ? String(episode.info).substring(0, 200) : 'null'}`, 'info');
    
    // Parse episode.info with enhanced error handling
    const episodeInfo = parseEpisodeInfo(episode);
    
    if (episodeInfo) {
      debug(`  episodeInfo keys: ${Object.keys(episodeInfo).join(', ')}`, 'info');
      debug(`  episodeInfo.movie_image: ${episodeInfo.movie_image || 'none'}`, 'info');
      debug(`  episodeInfo.plot: ${episodeInfo.plot ? episodeInfo.plot.substring(0, 50) + '...' : 'none'}`, 'info');
      debug(`  episodeInfo.duration: ${episodeInfo.duration || 'none'}`, 'info');
      debug(`  episodeInfo.video_quality: ${episodeInfo.video_quality || 'none'}`, 'info');
    } else {
      debug(`  episodeInfo: FAILED TO PARSE or null`, 'warn');
    }
    
    // Extract metadata with comprehensive fallback
    const metadata = extractEpisodeMetadata(episode, episodeInfo);
    const { thumbnail, plot, duration, quality, releasedate, tmdbId, audio, bitrate, rating } = metadata;

    debug(`  Extracted thumbnail: ${thumbnail ? 'YES (' + thumbnail.substring(0, 60) + '...)' : 'NO'}`, 'info');
    debug(`  Extracted plot: ${plot ? 'YES (' + plot.substring(0, 50) + '...)' : 'NO'}`, 'info');
    debug(`  Extracted duration: ${duration || 'NO'}`, 'info');
    debug(`  Extracted quality: ${quality || 'NO'}`, 'info');
    debug(`  Extracted releasedate: ${releasedate || 'NO'}`, 'info');
    debug(`  Extracted tmdbId: ${tmdbId || 'NO'}`, 'info');
    
    // Escape values for HTML attributes (data attributes)
    const safeStreamId = String(streamId).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeTitle = String(title).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeExt = String(ext).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    
    // Build thumbnail HTML with Play Overlay
    let thumbnailHtml;
    if (thumbnail) {
      thumbnailHtml = `
        <img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="episode-thumbnail-placeholder" style="display:none;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
      `;
    } else {
      thumbnailHtml = `
        <div class="episode-thumbnail-placeholder">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
      `;
    }
    
    // Add Play Overlay
    thumbnailHtml += `
      <div class="episode-play-overlay">
        <div class="play-icon-circle">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>
    `;
    
    // Add Badges to thumbnail
    thumbnailHtml += `<span class="episode-number">${epNum}</span>`;
    if (duration) {
      thumbnailHtml += `<span class="episode-duration-badge">${escapeHtml(duration)}</span>`;
    }
    
    const containerExt = ext.toUpperCase();
    
    // Create episode card with data attributes (no inline onclick)
    const card = document.createElement('div');
    card.className = 'episode-card';
    card.setAttribute('data-stream-id', safeStreamId);
    card.setAttribute('data-ext', safeExt);
    card.setAttribute('data-title', safeTitle);
    
    card.innerHTML = `
      <div class="episode-thumbnail">
        ${thumbnailHtml}
      </div>
      <div class="episode-info">
        <div class="episode-header">
           <div class="episode-title">${escapeHtml(title)}</div>
        </div>
        ${plot ? `<div class="episode-plot">${escapeHtml(plot)}</div>` : ''}
        ${rating ? `<div class="episode-rating">★ ${escapeHtml(rating)}</div>` : ''}
        ${quality ? `<div class="episode-quality-badge">${escapeHtml(quality)}</div>` : ''}
        ${releasedate ? `<div class="episode-releasedate">${escapeHtml(releasedate)}</div>` : ''}
        ${bitrate ? `<div class="episode-bitrate">${escapeHtml(bitrate)}</div>` : ''}
      </div>
    `;
    
    // Add click handler using event listener (better than inline onclick)
    card.addEventListener('click', () => {
      debug(`Episode card clicked: streamId=${streamId}, title="${title}"`, 'info');
      // Pass series_id if available from the series context
      const seriesId = state.currentSeriesId || null;
      playEpisodeSimple(streamId, ext, title, seriesId);
    });
    
    // Prevent play button from triggering card click twice
    const playBtn = card.querySelector('.play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        debug(`Play button clicked: streamId=${streamId}, title="${title}"`, 'info');
        // Pass series_id if available from the series context
        const seriesId = state.currentSeriesId || null;
        playEpisodeSimple(streamId, ext, title, seriesId);
      });
    }
    
    fragment.appendChild(card);
    renderedCount++;
    successCount++;
    debug(`✅ Episode ${index + 1} rendered successfully`, 'info');
  });
  
  episodesList.appendChild(fragment);
  
  // Final statistics
  debug(`════════════════════════════════════════════════════════════`, 'info');
  debug(`RENDER COMPLETE: ${renderedCount}/${episodes.length} episodes rendered`, 'info');
  debug(`  Success: ${successCount} | Skipped: ${skipCount} | Errors: ${errorCount}`, 'info');
  debug(`════════════════════════════════════════════════════════════`, 'info');
  
  // Verify DOM
  const cards = episodesList.querySelectorAll('.episode-card');
  debug(`DOM verification: ${cards.length} episode cards found in DOM`, 'info');
}

/**
 * Go back to previous view (series list)
 */
function goBack() {
  debug('>>> goBack CALLED');
  
  if (state.previousView) {
    debug('Restoring previous view:');
    debug('  category: ' + state.previousView.category);
    debug('  tab: ' + state.previousView.tab);
    debug('  items count: ' + (state.previousView.items ? state.previousView.items.length : 0));
    
    // Restore previous view state
    state.currentCategory = state.previousView.category;
    state.currentCategoryName = state.previousView.categoryName;
    state.items = state.previousView.items;
    state.currentTab = state.previousView.tab;
    
    // Clear previous view state
    state.previousView = null;
    
    // Re-render the items
    renderItems(state.items, state.currentTab);
    
    // Update breadcrumb
    if (elements.breadcrumb) {
      elements.breadcrumb.hidden = !state.currentCategory;
    }
    if (elements.breadcrumbTitle && state.currentCategoryName) {
      elements.breadcrumbTitle.textContent = state.currentCategoryName;
    }
    
    debug('✓ Navigated back');
  } else {
    debug('No previous view, reloading current tab');
    // Fallback: reload current tab content
    loadContent(state.currentTab);
  }
  
  debug('<<< goBack END');
}

/**
 * Toggle favorite status
 * @param {string} id - Stream ID
 * @param {string} name - Stream name
 * @param {string} type - Stream type
 * @param {HTMLElement} btn - Favorite button element
 */
function toggleFavorite(id, name, type, btn) {
  debug('>>> toggleFavorite CALLED');
  
  if (!id) {
    debug('ERROR: Cannot toggle favorite - missing ID', 'error');
    return;
  }
  
  var isActive = btn.classList.contains('active');
  debug('Toggling favorite:');
  debug('  id: ' + id);
  debug('  name: ' + name);
  debug('  type: ' + (type || state.currentTab));
  debug('  current state: ' + (isActive ? 'active' : 'inactive'));
  
  btn.classList.toggle('active');
  
  sendMessage('favorite', { 
    id: id, 
    name: name,
    type: type || state.currentTab 
  });
  
  debug('✓ Favorite toggle sent');
  debug('<<< toggleFavorite END');
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  debug('>>> setupEventListeners START');
  
  // Tab switching
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const type = tab.getAttribute('data-type');
      debug('[UI] Tab clicked: ' + type);
      loadContent(type);
    });
  });
  
  // Back button
  if (elements.backBtn) {
    elements.backBtn.addEventListener('click', () => {
      debug('[UI] Back button clicked');
      // If viewing series details, go back to series list
      if (state.previousView) {
        goBack();
      } else {
        loadContent(state.currentTab);
      }
    });
  }
  
  // Search with debounce
  if (elements.searchInput) {
    let debounceTimer;
    elements.searchInput.addEventListener('input', () => {
      const query = elements.searchInput.value.trim();
      if (elements.searchClear) elements.searchClear.hidden = query.length === 0;
      
      clearTimeout(debounceTimer);
      
      if (query.length >= 2) {
        debug('[UI] Search query: ' + query);
        debounceTimer = setTimeout(() => {
          debug('[Search] Sending search request: ' + query);
          sendMessage('search', { query: query });
        }, 300);
      } else if (query.length === 0) {
        debug('[UI] Search cleared');
        loadContent(state.currentTab);
      }
    });
  }
  
  // Search clear
  if (elements.searchClear) {
    elements.searchClear.addEventListener('click', () => {
      debug('[UI] Search clear clicked');
      if (elements.searchInput) elements.searchInput.value = '';
      elements.searchClear.hidden = true;
      loadContent(state.currentTab);
    });
  }
  
  // Refresh
  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', () => {
      debug('[UI] Refresh button clicked');
      if (state.currentCategory) {
        loadCategory(state.currentCategory, state.currentCategoryName);
      } else {
        loadContent(state.currentTab);
      }
    });
  }
  
  // Disconnect
  if (elements.disconnectBtn) {
    elements.disconnectBtn.addEventListener('click', () => {
      debug('[UI] Disconnect button clicked');
      if (confirm('Disconnect from IPTV server?')) {
        sendMessage('disconnect');
      }
    });
  }
  
  // EPG modal close
  const epgClose = document.getElementById('epg-close');
  if (epgClose) {
    epgClose.addEventListener('click', () => {
      debug('[UI] EPG modal close clicked');
      if (elements.epgModal) elements.epgModal.hidden = true;
    });
  }
  
  // Keyboard shortcuts and Navigation
  document.addEventListener('keydown', (e) => {
    // ESC to close EPG modal
    if (e.key === 'Escape') {
      if (elements.epgModal && !elements.epgModal.hidden) {
        debug('[UI] ESC pressed - closing EPG modal');
        elements.epgModal.hidden = true;
        return;
      }
    }
    
    // R to refresh
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT') {
      debug('[UI] R key pressed - refreshing');
      if (state.currentCategory) {
        loadCategory(state.currentCategory, state.currentCategoryName);
      } else {
        loadContent(state.currentTab);
      }
      return;
    }

    // Keyboard Navigation (Arrow Keys)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      handleKeyboardNavigation(e.key);
    }
    
    // Enter to activate
    if (e.key === 'Enter') {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.classList.contains('stream-card') || activeElement.classList.contains('category-card'))) {
            activeElement.click();
        }
    }
  });
}

/**
 * Handle arrow key navigation
 * @param {string} key - Arrow key pressed
 */
function handleKeyboardNavigation(key) {
  const focusableSelectors = '.stream-card, .category-card, .history-card, .season-btn, .episode-card';
  const items = Array.from(document.querySelectorAll(focusableSelectors));
  
  if (items.length === 0) return;
  
  // If no element is focused or focus is not on a list item, focus the first one
  const currentFocus = document.activeElement;
  const currentIndex = items.indexOf(currentFocus);
  
  if (currentIndex === -1) {
    items[0].focus();
    return;
  }
  
  // Grid navigation logic
  const gridStyle = window.getComputedStyle(elements.list);
  const gridCols = gridStyle.getPropertyValue('grid-template-columns').split(' ').length;
  
  // Fallback if grid columns can't be determined (e.g. 0)
  const columns = gridCols > 0 ? gridCols : 4;
  
  let nextIndex = currentIndex;
  
  switch (key) {
    case 'ArrowRight':
      nextIndex = Math.min(currentIndex + 1, items.length - 1);
      break;
    case 'ArrowLeft':
      nextIndex = Math.max(currentIndex - 1, 0);
      break;
    case 'ArrowDown':
      nextIndex = Math.min(currentIndex + columns, items.length - 1);
      break;
    case 'ArrowUp':
      nextIndex = Math.max(currentIndex - columns, 0);
      break;
  }
  
  if (nextIndex !== currentIndex) {
    items[nextIndex].focus();
    items[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  
  debug('<<< setupEventListeners END - Event listeners attached');
}

/**
 * Setup message handlers from plugin
 */
function setupMessageHandlers() {
  if (!window.iina || !iina.onMessage) {
    debug('WARNING: iina.onMessage not available', 'warn');
    updateConnectionStatus('error', '● Plugin Error');
    showEmpty('Plugin initialization error');
    return;
  }
  
  // Connection established
  updateConnectionStatus('connected', '● Connected');
  
  iina.onMessage('log', (data) => {
    debug('← RECV [log]: ' + String(data).substring(0, 100), 'received');
  });
  
  // Mark that we received a response from the plugin
  iina.onMessage('playReceived', (data) => {
    window._playResponseReceived = true;
    debug('← RECV [playReceived]: ' + JSON.stringify(data).substring(0, 100), 'received');
  });
  
  // Handler for load message acknowledgment
  iina.onMessage('loadReceived', (data) => {
    debug('← RECV [loadReceived]: ' + JSON.stringify(data), 'received');
    debug('Backend acknowledged load message for type: ' + (data ? data.type : 'unknown'));
  });
  
  iina.onMessage('categories', (data) => {
    const count = data && Array.isArray(data) ? data.length : 'invalid';
    debug(`← RECV [categories]: ${count} items`, 'received');
    renderCategories(data);
  });
  
  iina.onMessage('render', (data) => {
    const count = data && Array.isArray(data) ? data.length : 'invalid';
    debug(`← RECV [render]: ${count} items`, 'received');
    renderItems(data, state.currentTab);
  });
  
  iina.onMessage('favorites', (data) => {
    const count = data ? Object.keys(data).length : 0;
    debug(`← RECV [favorites]: ${count} items`, 'received');
    state.favorites = data || {};
    if (state.currentTab === 'favorites') {
      renderItems(Object.values(state.favorites), 'favorites');
    }
  });
  
  iina.onMessage('history', (data) => {
    const count = data && Array.isArray(data) ? data.length : 0;
    debug(`← RECV [history]: ${count} items`, 'received');
    if (state.currentTab === 'history') {
      renderItems(data || [], 'history');
    }
  });
  
  iina.onMessage('serverInfo', (data) => {
    debug(`← RECV [serverInfo]: ${JSON.stringify(data).substring(0, 100)}`, 'received');
    if (elements.serverName) {
      elements.serverName.textContent = (data && data.name) ? data.name : 'Connected';
    }
  });
  
  iina.onMessage('epgData', (data) => {
    debug('← RECV [epgData]: ' + (data ? 'data received' : 'no data'), 'received');
    renderEpg(data);
  });
  
  iina.onMessage('seriesInfo', (data) => {
    debug('← RECV [seriesInfo]: data received', 'received');
    
    // Clear the timeout since we received a response
    if (state.currentRequestTimeout) {
      clearTimeout(state.currentRequestTimeout);
      state.currentRequestTimeout = null;
      debug('Request timeout cleared');
    }
    
    debug('  data type: ' + typeof data);
    debug('  data has seasons: ' + (data && data.seasons ? 'YES' : 'NO'));
    if (data && data.seasons) {
      debug('  seasons type: ' + typeof data.seasons);
      debug('  seasons isArray: ' + Array.isArray(data.seasons));
      debug('  seasons keys: ' + Object.keys(data.seasons).join(','));
    }
    debug('  series name: ' + (data && data.name ? data.name : 'N/A'));
    
    hideLoading();
    debug('Loading hidden, calling renderSeriesDetails...');
    
    try {
      renderSeriesDetails(data);
      debug('renderSeriesDetails completed successfully');
    } catch (e) {
      debug('ERROR in renderSeriesDetails: ' + e.message, 'error');
      debug('Stack: ' + (e.stack || 'no stack'), 'error');
      showEmpty('Error displaying series details: ' + e.message);
    }
    
    debug('<<< seriesInfo handler END');
  });
  
  iina.onMessage('error', (message) => {
    debug('← RECV [error]: ' + message, 'error');
    // Clear timeout on error
    if (state.currentRequestTimeout) {
      clearTimeout(state.currentRequestTimeout);
      state.currentRequestTimeout = null;
    }
    hideLoading();
    showEmpty(message || 'An error occurred');
  });
  
  // Issue 3: Resume position handlers
  iina.onMessage('resumePosition', (data) => {
    debug('← RECV [resumePosition]: ' + JSON.stringify(data), 'received');
    if (data && data.data) {
      const resumeData = data.data;
      const position = resumeData.position || 0;
      const duration = resumeData.duration || 0;
      
      if (position > 10 && duration > 0 && position < duration - 30) {
        // Show resume option if more than 10 seconds watched and more than 30 seconds remaining
        const percent = Math.round((position / duration) * 100);
        const timeStr = formatTime(position);
        const message = `Reprendre la lecture depuis ${timeStr} (${percent}% visionné)?\n\nCliquez OK pour reprendre, Annuler pour recommencer du début.`;
        
        debug(`Resume prompt: ${timeStr} (${percent}% complete)`);
        
        if (confirm(message)) {
          // User wants to resume - trigger play with resume position
          debug('User chose to resume from position: ' + position);
          if (window._pendingPlay) {
            sendMessage('play', {
              ...window._pendingPlay,
              resumePosition: position
            });
            window._pendingPlay = null;
          }
        } else {
          // User wants to start from beginning
          debug('User chose to start from beginning');
          if (window._pendingPlay) {
            sendMessage('play', window._pendingPlay);
            window._pendingPlay = null;
          }
        }
      } else {
        // No valid resume position, play normally
        debug('No valid resume position, playing from beginning');
        if (window._pendingPlay) {
          sendMessage('play', window._pendingPlay);
          window._pendingPlay = null;
        }
      }
    } else {
      // No resume data, play normally
      debug('No resume data received, playing from beginning');
      if (window._pendingPlay) {
        sendMessage('play', window._pendingPlay);
        window._pendingPlay = null;
      }
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize browser
 */
function init() {
  cacheElements();
  setupEventListeners();
  setupDebugPanelListeners();
  setupMessageHandlers();
  
  debug('Browser initialization starting...', 'info');
  
  // Send ready signal
  if (sendMessage('ready')) {
    debug('Sent ready message');
  }
  
  // Load initial content
  loadContent('live');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose debug function globally for console access
window.iptvDebug = debug;
window.iptvState = state;
window.iptvSendMessage = sendMessage;

debug('╔══════════════════════════════════════════════════════════════╗', 'info');
debug('║  IPTV Browser UI Loaded                                      ║', 'info');
debug('║  Version: 6.2.0-HISTORY-RESUME-PERSISTENCE                   ║', 'info');
debug('║  File-Based History & Resume Storage                        ║', 'info');
debug('╚══════════════════════════════════════════════════════════════╝', 'info');
debug('Debug panel is visible at the bottom of the window', 'info');

// Check iina availability on startup
if (typeof window.iina !== 'undefined') {
  debug('✓ window.iina is available', 'info');
  if (typeof iina.postMessage === 'function') {
    debug('✓ iina.postMessage is available', 'info');
  } else {
    debug('✗ iina.postMessage is NOT available', 'error');
  }
  if (typeof iina.onMessage === 'function') {
    debug('✓ iina.onMessage is available', 'info');
  } else {
    debug('✗ iina.onMessage is NOT available', 'error');
  }
} else {
  debug('✗ window.iina is NOT available - running outside IINA?', 'warn');
}
