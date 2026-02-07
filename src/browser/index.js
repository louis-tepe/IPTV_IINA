import { state, elements, cacheElements } from './state.js';
import { renderCategories, renderItems, renderSeriesDetails, debug } from './render.js';
import { showLoading, hideLoading, showEmpty } from './ui.js';

// Aliases
const win = window;

// Actions
function sendMessage(action, data) {
  if (typeof iina !== 'undefined') {
    debug(`[sendMessage] Sending: ${action} with data: ${JSON.stringify(data)}`);
    iina.postMessage(action, data);
    return true;
  }
  debug(`[sendMessage] FAILED - iina is undefined! Action: ${action}`);
  return false;
}

function loadCategory(id, name) {
  state.currentCategory = id;
  state.currentCategoryName = name;
  showLoading();
  sendMessage('load', { type: state.currentTab, category: id });
}

function loadSeriesInfo(id, name) {
    showLoading();
    sendMessage('loadSeriesInfo', { seriesId: id, seriesName: name });
}

function playStream(id, ext, name, type) {
    sendMessage('play', { id, ext, name, type });
}

// Search debounce timer
let searchDebounceTimer = null;

// Setup
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  setupListeners();
  // Notify backend that frontend is ready
  if (typeof iina !== 'undefined') {
    iina.postMessage('ready', {});
  }
});

function setupListeners() {
  // Search Input - THIS WAS MISSING!
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      debug(`[Search] Input changed: "${query}"`);
      
      // Show/hide clear button
      if (elements.searchClear) {
        elements.searchClear.hidden = query.length === 0;
      }
      
      // Debounce search
      clearTimeout(searchDebounceTimer);
      
      if (query.length >= 2) {
        searchDebounceTimer = setTimeout(() => {
          debug(`[Search] Sending search request for: "${query}"`);
          showLoading('Searching...');
          sendMessage('search', { query });
          state.isSearching = true;
        }, 300);
      } else if (query.length === 0 && state.isSearching) {
        // Clear search - reload current tab categories
        debug('[Search] Cleared - reloading categories');
        state.isSearching = false;
        state.currentCategory = null;
        showLoading();
        sendMessage('load', { type: state.currentTab });
      }
    });
    
    // Handle Enter key for immediate search
    elements.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchDebounceTimer);
        const query = e.target.value.trim();
        if (query.length >= 2) {
          debug(`[Search] Enter pressed - immediate search for: "${query}"`);
          showLoading('Searching...');
          sendMessage('search', { query });
          state.isSearching = true;
        }
      }
    });
  }
  
  // Search Clear Button
  if (elements.searchClear) {
    elements.searchClear.addEventListener('click', () => {
      debug('[Search] Clear button clicked');
      if (elements.searchInput) {
        elements.searchInput.value = '';
        elements.searchClear.hidden = true;
        state.isSearching = false;
        state.currentCategory = null;
        showLoading();
        sendMessage('load', { type: state.currentTab });
      }
    });
  }

  if (elements.disconnectBtn) {
      elements.disconnectBtn.addEventListener('click', () => {
         // Handle disconnect
      });
  }
  
  // Tabs
  if (elements.tabs) {
      elements.tabs.forEach(tab => {
          tab.addEventListener('click', () => {
              // Clear search when switching tabs
              if (elements.searchInput) {
                elements.searchInput.value = '';
                if (elements.searchClear) elements.searchClear.hidden = true;
              }
              state.isSearching = false;
              
              const type = tab.getAttribute('data-type');
              state.currentTab = type;
              state.currentCategory = null;
              showLoading();
              sendMessage('load', { type });
              
              // Update tab UI
              elements.tabs.forEach(t => t.classList.remove('active'));
              tab.classList.add('active');
          });
      });
  }
}

// Message Handlers - using correct IINA API syntax
function setupMessageHandlers() {
  if (typeof iina === 'undefined') return;
  
  iina.onMessage('connected', (data) => {
    debug('Message from backend: connected');
    hideLoading();
    sendMessage('load', { type: 'live' });
  });
  
  iina.onMessage('error', (data) => {
    debug('Message from backend: error');
    hideLoading();
    if (data && data.message) alert(data.message);
  });
  
  iina.onMessage('categories', (data) => {
    debug('Message from backend: categories');
    hideLoading();
    renderCategories(data, loadCategory);
  });
  
  iina.onMessage('render', (data) => {
    debug('Message from backend: render');
    hideLoading();
    renderItems(data, state.currentTab, {
        onSeriesClick: loadSeriesInfo,
        onStreamClick: playStream
    });
  });
  
  iina.onMessage('seriesInfo', (data) => {
    debug('Message from backend: seriesInfo');
    hideLoading();
    renderSeriesDetails(data, {
         onStreamClick: playStream,
         onBack: () => {
             state.currentCategory = null;
             showLoading();
             sendMessage('load', { type: 'series' });
         }
    });
  });
  
  iina.onMessage('log', (data) => {
    console.log('[Backend]', data);
  });
}

// Initialize message handlers on load
setupMessageHandlers();
