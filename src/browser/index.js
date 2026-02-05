import { state, elements, cacheElements } from './state.js';
import { renderCategories, renderItems, renderSeriesDetails, debug } from './render.js';
import { showLoading, hideLoading, showEmpty } from './ui.js';

// Aliases
const win = window;

// Actions
function sendMessage(action, data) {
  if (win.iina) {
    iina.postMessage(action, data);
    return true;
  }
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

// Setup
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  setupListeners();
});

function setupListeners() {
  if (elements.disconnectBtn) {
      elements.disconnectBtn.addEventListener('click', () => {
         // Handle disconnect
      });
  }
  
  // Tabs
  if (elements.tabs) {
      elements.tabs.forEach(tab => {
          tab.addEventListener('click', () => {
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

// Message Handler
if (win.iina) {
  iina.onMessage = (action, data) => {
    debug(`Message from backend: ${action}`);
    
    switch(action) {
      case 'connected':
        hideLoading();
        // Load default content?
        sendMessage('load', { type: 'live' });
        break;
      case 'error':
        hideLoading();
        if (data.message) alert(data.message);
        break;
      case 'categories':
        renderCategories(data.data, loadCategory);
        break;
      case 'streams':
        renderItems(data.data, state.currentTab, {
            onSeriesClick: loadSeriesInfo,
            onStreamClick: playStream
        });
        break;
      case 'seriesInfo':
        renderSeriesDetails(data, {
             onStreamClick: playStream,
             onBack: () => {
                 // Simple back implementation: reload series content
                 // Improvements: implement proper history state
                 state.currentCategory = null; // reset
                 showLoading();
                 sendMessage('load', { type: 'series' });
             }
        });
        break;
      case 'log':
        console.log('[Backend]', data);
        break;
    }
  };
}
