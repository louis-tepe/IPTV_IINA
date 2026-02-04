/**
 * IINA IPTV Plugin - Browser UI Controller (Refactored)
 * v8.0.0 - Modularized Version
 * 
 * Main entry point for the browser UI
 * Handles all UI interactions and communication with the plugin backend
 */

'use strict';

// Import utility modules
const { t } = require('./utils/i18n');
const { cacheElements, escapeHtml, setViewMode, getRelativeTime, formatTime } = require('./utils/dom');
const { DEBUG, debug, updateConnectionStatus, clearDebugLogs, toggleDebugPanel, setupDebugPanelListeners } = require('./utils/debug');

// Import component modules
const { initVirtualScroll, cleanupVirtualScroll } = require('./components/virtualScroll');
const { initImageObserver, disconnectImageObserver } = require('./components/imageLoader');
const { renderEpisodesList, parseEpisodeInfo, extractEpisodeMetadata } = require('./components/series');
const { renderHistoryItems } = require('./components/history');
const { showEpg, renderEpg, setupEpgCloseHandler } = require('./components/epg');

// ============================================
// STATE MANAGEMENT
// ============================================

/** @type {BrowserState} */
const state = {
  isConnected: false,
  currentTab: 'live',
  currentCategory: null,
  currentCategoryName: '',
  currentSeriesId: null,
  items: [],
  favorites: {},
  currentRequestId: 0,
  isLoading: false,
  previousView: null,
  currentRequestTimeout: null,
  debugMsgCount: 0,
  debugMinimized: false,
  debugVisible: DEBUG
};

// Cached DOM elements
/** @type {Object.<string, HTMLElement>} */
const elements = {};

// ============================================
// GLOBAL DEBUG PLAY FUNCTION
// ============================================

/**
 * Global function to play episode - called via inline onclick
 * @param {string} streamId - Episode stream ID
 * @param {string} ext - File extension
 * @param {string} title - Episode title
 * @param {string} [seriesId] - Parent series ID (for history tracking)
 */
function playEpisodeSimple(streamId, ext, title, seriesId) {
  if (!streamId || !window.iina) return;
  iina.postMessage('play', {
    id: String(streamId).trim(),
    type: 'series',
    ext: ext || 'mp4',
    name: title || 'Unknown Episode',
    directStream: true,
    series_id: seriesId ? String(seriesId) : null,
    timestamp: Date.now()
  });
}

// Make it globally available
window.playEpisodeSimple = playEpisodeSimple;

// ============================================
// MOVIE DETAILS MODAL
// ============================================

let currentModalData = null;

/**
 * Format duration from minutes to readable format
 * @param {number} minutes - Duration in minutes
 * @returns {string}
 */
function formatDuration(minutes) {
  if (!minutes || isNaN(minutes)) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Show movie details modal
 * @param {Object} item - Movie data
 */
function showMovieModal(item) {
  const modal = document.getElementById('movie-modal');
  if (!modal) return;
  
  currentModalData = item;
  
  const header = document.getElementById('movie-modal-header');
  const title = document.getElementById('movie-modal-title');
  const meta = document.getElementById('movie-modal-meta');
  const synopsis = document.getElementById('movie-modal-synopsis');
  
  // Set backdrop
  const backdrop = item.backdrop_path || item.stream_icon || item.cover || '';
  if (header) {
    header.style.backgroundImage = backdrop ? `url('${backdrop}')` : 'none';
  }
  
  // Set title
  if (title) title.textContent = item.name || item.title || 'Unknown';
  
  // Build meta badges
  let metaHtml = '';
  if (item.rating) {
    metaHtml += `<span class="movie-modal-badge rating">★ ${item.rating}</span>`;
  }
  if (item.releaseDate || item.year) {
    const year = item.year || (item.releaseDate ? item.releaseDate.split('-')[0] : '');
    if (year) metaHtml += `<span class="movie-modal-badge">${year}</span>`;
  }
  if (item.duration) {
    metaHtml += `<span class="movie-modal-badge">${formatDuration(item.duration)}</span>`;
  }
  if (item.genre) {
    metaHtml += `<span class="movie-modal-badge">${item.genre}</span>`;
  }
  if (meta) meta.innerHTML = metaHtml;
  
  // Set synopsis
  if (synopsis) {
    synopsis.textContent = item.plot || item.description || item.synopsis || 'No description available.';
  }
  
  // Show modal
  modal.hidden = false;
  modal.classList.add('active');
  
  // Announce to screen readers
  const liveRegion = document.getElementById('live-region');
  if (liveRegion) {
    liveRegion.textContent = `Opened details for ${item.name || 'movie'}`;
  }
}

/**
 * Close movie modal
 */
function closeMovieModal() {
  const modal = document.getElementById('movie-modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => { modal.hidden = true; }, 300);
  }
  currentModalData = null;
}

/**
 * Play from modal
 */
function playFromModal() {
  if (!currentModalData) return;
  const id = currentModalData.stream_id || currentModalData.id;
  const ext = currentModalData.container_extension || 'mp4';
  const name = currentModalData.name || currentModalData.title || 'Unknown';
  playStream(id, ext, name, 'vod');
  closeMovieModal();
}

// Setup modal event listeners
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('movie-modal-close');
  const playBtn = document.getElementById('movie-modal-play');
  const overlay = document.getElementById('movie-modal');
  
  if (closeBtn) closeBtn.addEventListener('click', closeMovieModal);
  if (playBtn) playBtn.addEventListener('click', playFromModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeMovieModal();
    });
  }
  
  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMovieModal();
  });
  
  // Detect keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      document.body.classList.add('keyboard-nav');
    }
  });
  document.addEventListener('mousedown', () => {
    document.body.classList.remove('keyboard-nav');
  });
});

// ============================================
// LOADING & UI STATE
// ============================================

const MAX_ITEMS_ANIMATION = 50;

/**
 * Show loading skeleton
 */
function showLoading() {
  state.isLoading = true;
  if (elements.loading) elements.loading.hidden = true;
  if (elements.empty) elements.empty.hidden = true;
  
  if (elements.list) {
    const skeletonCount = 20;
    let html = '<div class="skeleton-grid">';
    for (let i = 0; i < skeletonCount; i++) {
      html += '<div class="skeleton-card"></div>';
    }
    html += '</div>';
    elements.list.innerHTML = html;
  }
}

/**
 * Hide loading spinner
 */
function hideLoading() {
  state.isLoading = false;
  if (elements.loading) elements.loading.hidden = true;
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
 * Render category cards
 * @param {Array} categories - Categories array
 */
function renderCategories(categories) {
  hideLoading();
  
  if (!categories || !Array.isArray(categories)) {
    debug('Invalid categories data received', 'error');
    showEmpty('Invalid response from server');
    return;
  }
  
  if (categories.length === 0) {
    showEmpty('No categories found');
    return;
  }
  
  if (elements.empty) elements.empty.hidden = true;
  
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
    let iconPath = 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z';
    
    const nameLower = name.toLowerCase();
    if (nameLower.includes('movie') || nameLower.includes('film') || nameLower.includes('vod')) {
      iconPath = 'M19.82 2H4.18C2.97 2 2 2.97 2 4.18v15.64C2 21.03 2.97 22 4.18 22h15.64c1.21 0 2.18-.97 2.18-2.18V4.18C22 2.97 21.03 2 19.82 2zM7 2v20M17 2v20M2 12h5M2 7h5M2 17h5M17 17h5M17 7h5M17 12h5';
    } else if (nameLower.includes('series') || nameLower.includes('show') || nameLower.includes('tv')) {
      iconPath = 'M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z';
    } else if (nameLower.includes('sport') || nameLower.includes('foot') || nameLower.includes('soccer')) {
      iconPath = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z';
    } else if (nameLower.includes('kid') || nameLower.includes('enfant') || nameLower.includes('cartoon') || nameLower.includes('anime')) {
      iconPath = 'M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z';
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
}

/**
 * Create a stream card element
 * @param {Object} item - Stream item
 * @param {string} type - Content type
 * @param {number} index - Item index
 * @returns {HTMLElement}
 */
function createStreamCard(item, type, index) {
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
    posterHtml = `<img data-src="${poster}" alt="" class="lazy-image" loading="lazy">`;
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
  
  // Click handler
  card.addEventListener('click', (e) => {
    if (e.target.closest('.stream-favorite') || e.target.closest('.stream-epg-btn')) return;
    
    if (searchType === 'series') {
      loadSeriesInfo(id, name);
    } else if (searchType === 'vod') {
      // Show modal for VOD
      showMovieModal(item);
    } else {
      playStream(id, ext, name, searchType);
    }
  });
  
  const favBtn = card.querySelector('.stream-favorite');
  if (favBtn) {
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Add animation
      favBtn.classList.add('animating');
      setTimeout(() => favBtn.classList.remove('animating'), 400);
      toggleFavorite(id, name, searchType, favBtn);
    });
  }
  
  // EPG button
  const epgBtn = card.querySelector('.stream-epg-btn');
  if (epgBtn) {
    epgBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEpg(id, name, elements.epgModal, elements.epgContent, sendMessage, debug);
    });
  }
  
  return card;
}

/**
 * Render stream cards with virtual scrolling support
 * @param {Array} list - Items array
 * @param {string} type - Content type
 * @param {Object} virtualConfig - Optional virtual scroll configuration
 */
function renderItems(list, type, virtualConfig) {
  hideLoading();
  cleanupVirtualScroll(elements.list);
  
  if (type !== 'history' && elements.list) {
    elements.list.className = 'content-grid';
  }
  
  setViewMode(elements.list, true);
  
  if (!list || !Array.isArray(list)) {
    debug('Invalid items data received', 'error');
    showEmpty('Invalid response from server');
    return;
  }
  
  state.items = list;
  
  if (list.length === 0) {
    showEmpty('No content found');
    return;
  }
  
  debug('Rendering ' + list.length + ' items of type: ' + type);
  
  if (elements.empty) elements.empty.hidden = true;
  
  // Use enhanced history rendering for history type
  if (type === 'history') {
    renderHistoryItems(list, elements.list, escapeHtml, getRelativeTime, loadSeriesInfo, playStream);
    return;
  }
  
  // Check if we should use virtual scrolling
  const VIRTUAL_THRESHOLD = 50;
  if (list.length > VIRTUAL_THRESHOLD && !virtualConfig?.disableVirtual) {
    const vConfig = {
      itemHeight: 180,
      bufferSize: 5,
      threshold: VIRTUAL_THRESHOLD,
      cacheKey: type + ':' + (state.currentCategory || 'all')
    };
    
    // Define render callback for virtual scroll
    const renderCallback = (items, startIndex, container) => {
      const fragment = document.createDocumentFragment();
      items.forEach((item, index) => {
        if (!item) return;
        const actualIndex = startIndex + index;
        const card = createStreamCard(item, type, actualIndex);
        if (card) fragment.appendChild(card);
      });
      container.innerHTML = '';
      container.appendChild(fragment);
      initImageObserver(elements.list);
    };
    
    if (initVirtualScroll(list, vConfig, elements.list, renderCallback)) {
      if (elements.itemCount) {
        elements.itemCount.textContent = `${list.length} items (virtual scroll)`;
      }
      return;
    }
  }
  
  // Normal rendering
  const fragment = document.createDocumentFragment();
  
  list.forEach((item, index) => {
    if (!item) return;
    const card = createStreamCard(item, type, index);
    if (card) fragment.appendChild(card);
  });
  
  if (elements.list) {
    elements.list.innerHTML = '';
    elements.list.appendChild(fragment);
  }
  
  initImageObserver(elements.list);
  
  if (elements.itemCount) {
    elements.itemCount.textContent = `${list.length} items`;
  }
}

/**
 * Render series details with seasons and episodes
 * @param {Object} data - Series data with seasons and episodes
 */
function renderSeriesDetails(data) {
  hideLoading();
  setViewMode(elements.list, false);
  
  if (!data) {
    debug('No data received in renderSeriesDetails', 'error');
    showEmpty('No series information received');
    return;
  }
  
  if (!data.seasons) {
    data.seasons = {};
  }
  
  const { seriesId, name, cover, plot, seasons } = data;
  
  if (seriesId) {
    state.currentSeriesId = seriesId;
  }
  
  // Convert object format to array format
  let seasonsArray = seasons;
  if (!Array.isArray(seasons) && typeof seasons === 'object' && seasons !== null) {
    seasonsArray = Object.keys(seasons).map(key => ({
      season_number: parseInt(key, 10),
      num: parseInt(key, 10),
      episodes: seasons[key]
    })).sort((a, b) => a.season_number - b.season_number);
  }
  
  const finalSeasons = Array.isArray(seasonsArray) ? seasonsArray : [];
  
  if (elements.empty) elements.empty.hidden = true;
  
  if (elements.list) elements.list.innerHTML = '';
  
  if (elements.breadcrumb) elements.breadcrumb.hidden = true;
  if (elements.breadcrumbTitle) elements.breadcrumbTitle.textContent = name || 'Series Details';
  
  const container = document.createElement('div');
  container.className = 'series-details-container';
  
  const backdropUrl = data.backdrop_path || data.backdrop || data.background || cover || '';
  
  const headerHtml = `
    <div class="series-header" style="background-image: url('${escapeHtml(backdropUrl)}');">
      <button class="btn-hero-back" id="hero-back-btn" aria-label="${t('nav.back')}">
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
            ${finalSeasons.length > 0 ? `<div>${t('nav.seasons', {count: finalSeasons.length, plural: finalSeasons.length > 1 ? 's' : ''})}</div>` : ''}
          </div>
          
          ${plot ? `<p class="series-plot">${escapeHtml(plot)}</p>` : ''}
          
          <div class="series-actions">
            <button class="btn-hero btn-hero-play" id="hero-play-btn">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              ${t('series.play')}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  let seasonsHtml = '<div class="seasons-section"><div class="seasons-header"><h3>' + t('series.seasons') + '</h3></div><div class="seasons-selector"><div class="seasons-list">';

  if (finalSeasons.length === 0) {
    seasonsHtml += '<p class="no-seasons">' + t('series.noSeasons') + '</p>';
  } else {
    finalSeasons.forEach((season, index) => {
      const seasonNum = season.season_number || season.num || (index + 1);
      const isActive = index === 0 ? 'active' : '';
      seasonsHtml += `
        <button class="season-btn ${isActive}" data-season-index="${index}" data-season-num="${seasonNum}">
          ${t('series.season', {num: seasonNum})}
        </button>
      `;
    });
  }
  
  seasonsHtml += '</div></div></div>';
  
  const episodesHtml = '<div class="episodes-container"><h3>' + t('series.episodes') + '</h3><div class="episodes-list"></div></div>';
  
  container.innerHTML = headerHtml + seasonsHtml + episodesHtml;
  
  if (elements.list) {
    elements.list.appendChild(container);
  }
  
  if (elements.itemCount) {
    elements.itemCount.textContent = t('nav.seasons', {count: finalSeasons.length, plural: finalSeasons.length > 1 ? 's' : ''});
  }
  
  // Render episodes for the first season
  if (finalSeasons.length > 0) {
    renderEpisodesList(finalSeasons[0].episodes || [], cover, escapeHtml, t, seriesId, playEpisodeSimple);
  } else {
    renderEpisodesList([], cover, escapeHtml, t, seriesId, playEpisodeSimple);
  }
  
  // Add event listeners to season buttons
  const seasonButtons = container.querySelectorAll('.season-btn');
  seasonButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      seasonButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const seasonIndex = parseInt(btn.getAttribute('data-season-index'), 10);
      const season = finalSeasons[seasonIndex];
      if (season && season.episodes) {
        renderEpisodesList(season.episodes, cover, escapeHtml, t, seriesId, playEpisodeSimple);
      }
    });
  });
  
  // Hero Play Button
  const heroPlayBtn = container.querySelector('#hero-play-btn');
  if (heroPlayBtn) {
    if (finalSeasons.length > 0 && finalSeasons[0].episodes && finalSeasons[0].episodes.length > 0) {
      heroPlayBtn.addEventListener('click', () => {
        const firstEp = finalSeasons[0].episodes[0];
        const streamId = firstEp.id || firstEp.stream_id || firstEp.episode_id;
        const ext = firstEp.container_extension || 'mp4';
        const title = firstEp.title || (firstEp.episode_num ? t('series.episode', {num: firstEp.episode_num}) : t('series.episode', {num: 1}));
        playEpisodeSimple(streamId, ext, title, seriesId);
      });
    } else {
      heroPlayBtn.style.opacity = '0.5';
      heroPlayBtn.style.cursor = 'not-allowed';
      heroPlayBtn.title = t('series.noEpisodes');
    }
  }

  // Hero Back Button
  const heroBackBtn = container.querySelector('#hero-back-btn');
  if (heroBackBtn) {
    heroBackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      goBack();
    });
  }
  
  debug(`Rendered series details: ${name} with ${finalSeasons.length} seasons`);
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
  state.currentCategory = catId;
  state.currentCategoryName = catName;
  
  if (elements.breadcrumb) elements.breadcrumb.hidden = false;
  if (elements.breadcrumbTitle) elements.breadcrumbTitle.textContent = catName;
  if (elements.list) elements.list.innerHTML = '';
  
  showLoading();
  
  if (!sendMessage('load', { type: state.currentTab, category: catId })) {
    hideLoading();
    showEmpty('Plugin error: Cannot communicate with IINA');
  }
}

/**
 * Load content for current tab
 * @param {string} type - Content type
 */
function loadContent(type) {
  cleanupVirtualScroll(elements.list);
  disconnectImageObserver();
  
  state.currentTab = type;
  state.currentCategory = null;
  state.currentCategoryName = '';
  
  if (elements.breadcrumb) elements.breadcrumb.hidden = true;
  if (elements.list) elements.list.innerHTML = '';
  
  elements.tabs.forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-type') === type);
  });
  
  showLoading();
  
  if (!sendMessage('load', { type: type })) {
    hideLoading();
    showEmpty('Plugin error: Cannot communicate with IINA');
  }
}

/**
 * Play a stream
 * @param {string} id - Stream ID
 * @param {string} ext - File extension
 * @param {string} name - Stream name
 * @param {string} type - Stream type
 */
function playStream(id, ext, name, type) {
  if (!id) {
    debug('Cannot play - missing stream ID', 'error');
    return;
  }
  
  sendMessage('getResumePosition', { streamId: id });
  
  window._pendingPlay = { id, ext, name, type: type || state.currentTab };
  
  setTimeout(() => {
    if (window._pendingPlay && window._pendingPlay.id === id) {
      sendMessage('play', { 
        id: id, 
        ext: ext, 
        name: name,
        type: type || state.currentTab 
      });
      window._pendingPlay = null;
    }
  }, 500);
}

/**
 * Load series information (seasons and episodes)
 * @param {string} seriesId - Series ID
 * @param {string} seriesName - Series name
 */
function loadSeriesInfo(seriesId, seriesName) {
  showLoading();
  
  if (state.currentRequestTimeout) {
    clearTimeout(state.currentRequestTimeout);
    state.currentRequestTimeout = null;
  }
  
  state.previousView = {
    category: state.currentCategory,
    categoryName: state.currentCategoryName,
    items: state.items,
    tab: state.currentTab
  };
  
  state.currentRequestTimeout = setTimeout(() => {
    debug('loadSeriesInfo timeout - no response from backend after 15s', 'error');
    hideLoading();
    showEmpty('Request timeout: No response from server. Please try again.');
    state.currentRequestTimeout = null;
  }, 15000);
  
  if (!sendMessage('loadSeriesInfo', { seriesId, seriesName })) {
    if (state.currentRequestTimeout) {
      clearTimeout(state.currentRequestTimeout);
      state.currentRequestTimeout = null;
    }
    hideLoading();
    showEmpty('Plugin error: Cannot communicate with IINA');
  }
}

/**
 * Go back to previous view
 */
function goBack() {
  cleanupVirtualScroll(elements.list);
  disconnectImageObserver();
  
  if (state.previousView) {
    state.currentCategory = state.previousView.category;
    state.currentCategoryName = state.previousView.categoryName;
    state.items = state.previousView.items;
    state.currentTab = state.previousView.tab;
    
    state.previousView = null;
    
    renderItems(state.items, state.currentTab);
    
    if (elements.breadcrumb) {
      elements.breadcrumb.hidden = !state.currentCategory;
    }
    if (elements.breadcrumbTitle && state.currentCategoryName) {
      elements.breadcrumbTitle.textContent = state.currentCategoryName;
    }
  } else {
    loadContent(state.currentTab);
  }
}

/**
 * Toggle favorite status
 * @param {string} id - Stream ID
 * @param {string} name - Stream name
 * @param {string} type - Stream type
 * @param {HTMLElement} btn - Favorite button element
 */
function toggleFavorite(id, name, type, btn) {
  if (!id) {
    debug('Cannot toggle favorite - missing ID', 'error');
    return;
  }
  
  btn.classList.toggle('active');
  
  sendMessage('favorite', { 
    id: id, 
    name: name,
    type: type || state.currentTab 
  });
}

// ============================================
// MESSAGE HANDLING
// ============================================

/**
 * Wrapper for iina.postMessage that logs all messages
 * @param {string} action - Message action
 * @param {*} data - Message data
 * @returns {boolean} Success status
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
    updateConnectionStatus(elements.connectionStatus, 'error', '● Not Connected');
    return false;
  }
}

/**
 * Setup message handlers from plugin
 */
function setupMessageHandlers() {
  if (!window.iina || !iina.onMessage) {
    debug('iina.onMessage not available', 'warn');
    updateConnectionStatus(elements.connectionStatus, 'error', '● Plugin Error');
    showEmpty('Plugin initialization error');
    return;
  }
  
  updateConnectionStatus(elements.connectionStatus, 'connected', '● Connected');
  
  iina.onMessage('log', (data) => {
    debug('← RECV [log]: ' + String(data).substring(0, 100), 'received');
  });
  
  iina.onMessage('playReceived', (data) => {
    window._playResponseReceived = true;
    debug('← RECV [playReceived]: ' + JSON.stringify(data).substring(0, 100), 'received');
  });
  
  iina.onMessage('loadReceived', (data) => {
    debug('← RECV [loadReceived]: ' + JSON.stringify(data), 'received');
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
    renderEpg(data, elements.epgContent, elements.epgModal, escapeHtml, debug);
  });
  
  iina.onMessage('seriesInfo', (data) => {
    debug('← RECV [seriesInfo]: data received', 'received');
    
    if (state.currentRequestTimeout) {
      clearTimeout(state.currentRequestTimeout);
      state.currentRequestTimeout = null;
    }
    
    hideLoading();
    
    try {
      renderSeriesDetails(data);
    } catch (e) {
      debug('ERROR in renderSeriesDetails: ' + e.message, 'error');
      showEmpty('Error displaying series details: ' + e.message);
    }
  });
  
  iina.onMessage('error', (message) => {
    debug('← RECV [error]: ' + message, 'error');
    if (state.currentRequestTimeout) {
      clearTimeout(state.currentRequestTimeout);
      state.currentRequestTimeout = null;
    }
    hideLoading();
    showEmpty(message || 'An error occurred');
  });
  
  iina.onMessage('resumePosition', (data) => {
    if (data && data.data) {
      const resumeData = data.data;
      const position = resumeData.position || 0;
      const duration = resumeData.duration || 0;
      
      if (position > 10 && duration > 0 && position < duration - 30) {
        const percent = Math.round((position / duration) * 100);
        const timeStr = formatTime(position);
        const message = t('resume.message', {time: timeStr, percent: percent});
        
        if (confirm(message)) {
          if (window._pendingPlay) {
            sendMessage('play', {
              ...window._pendingPlay,
              resumePosition: position
            });
            window._pendingPlay = null;
          }
        } else {
          if (window._pendingPlay) {
            sendMessage('play', window._pendingPlay);
            window._pendingPlay = null;
          }
        }
      } else {
        if (window._pendingPlay) {
          sendMessage('play', window._pendingPlay);
          window._pendingPlay = null;
        }
      }
    } else {
      if (window._pendingPlay) {
        sendMessage('play', window._pendingPlay);
        window._pendingPlay = null;
      }
    }
  });
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Tab switching
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const type = tab.getAttribute('data-type');
      loadContent(type);
    });
  });
  
  // Back button
  if (elements.backBtn) {
    elements.backBtn.addEventListener('click', () => {
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
        debounceTimer = setTimeout(() => {
          sendMessage('search', { query: query });
        }, 300);
      } else if (query.length === 0) {
        loadContent(state.currentTab);
      }
    });
  }
  
  // Search clear
  if (elements.searchClear) {
    elements.searchClear.addEventListener('click', () => {
      if (elements.searchInput) elements.searchInput.value = '';
      elements.searchClear.hidden = true;
      loadContent(state.currentTab);
    });
  }
  
  // Refresh
  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', () => {
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
      if (confirm('Disconnect from IPTV server?')) {
        sendMessage('disconnect');
      }
    });
  }
  
  // EPG modal close
  setupEpgCloseHandler(document.getElementById('epg-close'), elements.epgModal);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elements.epgModal && !elements.epgModal.hidden) {
        elements.epgModal.hidden = true;
        return;
      }
    }
    
    if (e.key === 'd' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT') {
      toggleDebugPanel(elements.debugPanel, elements.debugToggle);
      return;
    }
    
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT') {
      if (state.currentCategory) {
        loadCategory(state.currentCategory, state.currentCategoryName);
      } else {
        loadContent(state.currentTab);
      }
      return;
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
  try {
    // Cache elements
    Object.assign(elements, cacheElements());
    
    setupEventListeners();
    setupDebugPanelListeners(
      elements.debugClear,
      elements.debugToggle,
      elements.debugPanel,
      elements.debugLogs,
      elements.debugMsgCount
    );
    setupMessageHandlers();
    
    if (elements.debugPanel) {
      elements.debugPanel.hidden = !state.debugVisible;
    }
    
    if (DEBUG) {
      debug('Browser initialization starting...', 'info');
    }
    
    sendMessage('ready');
    
    loadContent('live');
  } catch (e) {
    debug('Initialization error: ' + e.message, 'error');
    // Display error visually
    if (elements.list) {
      elements.list.innerHTML = '<div style="color:red;padding:20px;">Error: ' + escapeHtml(e.message) + '</div>';
    }
  }
}

// Global error handler
window.onerror = function(msg, url, line, col, error) {
  debug('Global error: ' + msg + ' at ' + line + ':' + col, 'error');
  return false;
};

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.iina && iina.postMessage) {
    iina.postMessage('saveCache');
  }
  
  cleanupVirtualScroll(elements.list);
  disconnectImageObserver();
});

// Expose globals for console access
window.iptvDebug = debug;
window.iptvState = state;
window.iptvSendMessage = sendMessage;

if (DEBUG) {
  debug('IPTV Browser UI Loaded - v8.0.0 (Modular)', 'info');
  debug('Press "D" to toggle debug panel visibility', 'info');
}