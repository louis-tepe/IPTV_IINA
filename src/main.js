/**
 * IINA IPTV Plugin - Main Entry Point
 * Modular architecture using src components
 */

'use strict';

const { state, DEBUG, LOG_PREFIX } = require('./core/state');
const { Logger } = require('./utils/helpers');
const { Storage } = require('./managers/storage');
const { XtreamAPI } = require('./api/xtream');

// IINA Global Objects
const event = iina.event;
const core = iina.core;
const mpv = iina.mpv;
const input = iina.input;

Logger.log('Initializing IPTV Plugin (Modular v8.0.0)...');

// Initialize Managers
const storage = new Storage();
let api = null;

// State tracking
let playbackTracker = null;
let lastSavedTime = 0;
let isWindowLoaded = false;
let overlayOpen = false;
let pendingOverlayOpen = false;
const SAVE_INTERVAL = 5000; // 5 seconds
const INITIAL_SEEK_DELAY = 1000;

// ============================================================================
// Initialization
// ============================================================================

function init() {
  // Load configuration
  const config = storage.getConfig();
  if (config && config.server && config.username && config.password) {
    Logger.log('Credentials found, initializing API');
    api = new XtreamAPI(config);
    state.isConnected = true;
  } else {
    Logger.log('No credentials configured');
  }

  // Register listeners
  registerIinaEvents();
  
  // Start polling for overlay open signal from global.js
  startOverlayPolling();
  
  // Wait for window to be loaded before initializing UI
  event.on('iina.window-loaded', () => {
    Logger.log('Window loaded event received');
    isWindowLoaded = true;
    
    // If there's a pending overlay open request, execute it now
    if (pendingOverlayOpen) {
      Logger.log('Executing pending overlay open request');
      pendingOverlayOpen = false;
      openFullscreenOverlay();
    }
  });
}

/**
 * Update API client when config changes
 */
function updateApiConfig() {
  const config = storage.getConfig();
  if (config && config.server && config.username && config.password) {
    api = new XtreamAPI(config);
    state.isConnected = true;
    return true;
  }
  return false;
}

// ============================================================================
// UI Management (Fullscreen Overlay)
// ============================================================================

function openFullscreenOverlay() {
  // Check if overlay already open
  if (overlayOpen) {
    Logger.log('Overlay already open');
    return;
  }
  
  // Wait for window to be loaded
  if (!isWindowLoaded) {
    Logger.log('Window not loaded yet, queuing overlay open request...');
    pendingOverlayOpen = true;
    return;
  }
  
  Logger.log('Opening fullscreen IPTV overlay...');
  
  try {
    iina.overlay.simpleMode();
    iina.overlay.setClickable(true);
    iina.overlay.setOpacity(1.0);
    iina.overlay.loadFile('ui/browser.html');
    iina.overlay.onMessage(handleOverlayMessage);
    iina.overlay.show();
    overlayOpen = true;
    Logger.log('Fullscreen overlay opened successfully');
  } catch (e) {
    Logger.error('Failed to open overlay: ' + e.message);
  }
}

function closeOverlay() {
  if (!overlayOpen) {
    Logger.log('Overlay not open');
    return;
  }
  
  try {
    iina.overlay.hide();
    overlayOpen = false;
    Logger.log('Overlay closed');
  } catch (e) {
    Logger.error('Failed to close overlay: ' + e.message);
  }
}

function startOverlayPolling() {
  // Poll for signal from global.js
  setInterval(() => {
    const signal = iina.preferences.get('iptv_open_overlay');
    if (signal) {
      try {
        const data = JSON.parse(signal);
        Logger.log('Received overlay open signal');
        // Clear the signal
        iina.preferences.set('iptv_open_overlay', null);
        // Open overlay
        openFullscreenOverlay();
      } catch (e) {
        Logger.error('Failed to parse overlay signal: ' + e.message);
      }
    }
  }, 500);
}

function handleOverlayMessage(msg) {
  const type = msg.type || msg.action || msg.name;
  
  // Helper function to post message to overlay
  const postResponse = (data) => {
    if (overlayOpen) {
      iina.overlay.postMessage(data);
    } else {
      Logger.warn('Overlay not open, cannot post response');
    }
  };
  
  switch (type) {
    case 'ready':
      Logger.log('Overlay reported ready');
      const config = storage.getConfig();
      postResponse({
        action: 'init',
        data: {
          configured: !!(config && config.server),
          server: config ? config.server : null
        }
      });
      break;

    case 'close':
      Logger.log('Overlay requested close');
      closeOverlay();
      break;

    case 'getCategories':
      if (!api) {
        postResponse({ action: 'error', data: { message: 'Server not configured' } });
        return;
      }
      
      const catType = msg.data ? msg.data.type : 'live';
      let promise;
      
      if (catType === 'live') promise = api.request('get_live_categories');
      else if (catType === 'vod') promise = api.request('get_vod_categories');
      else if (catType === 'series') promise = api.request('get_series_categories');
      
      if (promise) {
        promise
          .then(data => postResponse({ action: 'categories', data: data }))
          .catch(err => postResponse({ action: 'error', data: { message: err.message } }));
      }
      break;

    case 'getStreams':
      if (!api) return;
      
      const { categoryId, categoryName } = msg.data || {};
      const streamType = msg.data ? msg.data.type : 'live';
      
      let streamPromise;
      if (streamType === 'live') streamPromise = api.request('get_live_streams', { category_id: categoryId });
      else if (streamType === 'vod') streamPromise = api.request('get_vod_streams', { category_id: categoryId });
      else if (streamType === 'series') streamPromise = api.request('get_series', { category_id: categoryId });
      
      if (streamPromise) {
        streamPromise
          .then(streams => postResponse({ action: 'streams', data: { streams, categoryName } }))
          .catch(err => postResponse({ action: 'error', data: { message: err.message } }));
      }
      break;

    case 'play':
      if (!api) return;
      const playData = msg.data || {};
      
      let url;
      if (playData.type === 'series') {
          url = api.getSeriesEpisodeUrl(playData.id, playData.ext || 'mp4');
      } else {
          url = api.getStreamUrl(playData.id, playData.type, playData.ext || 'ts');
      }
      
      // Close overlay when starting playback
      closeOverlay();
      playStream(url, playData.name, playData.id, playData.type, playData.resumePosition);
      break;
      
    default:
      Logger.log(`Unhandled message type: ${type}`);
      break;
  }
}

// ============================================================================
// Input Handling (ESC to close overlay)
// ============================================================================

function registerInputHandlers() {
  // Register ESC key handler to close overlay
  input.onKeyDown((e) => {
    // ESC key (key code 53 on macOS)
    if (e.key === 53 && overlayOpen) {
      closeOverlay();
      return true; // Event handled
    }
    return false; // Let other handlers process
  }, input.PRIORITY_LOW);
}

// ============================================================================
// Playback Logic
// ============================================================================

function playStream(url, name, id, type, initialPosition) {
  Logger.log(`Playing: ${name} (${url})`);
  
  // Save current stream info for resume tracking
  state.currentStream = { id, type, name };
  
  core.open(url);

  // Handle Resume
  if (!initialPosition && id) {
    const resume = storage.getResumePosition(id);
    if (resume && resume.position > 0) {
      initialPosition = resume.position;
      Logger.log(`Found resume point: ${initialPosition}s`);
    }
  }

  if (initialPosition > 0) {
    // Schedule seek
    setTimeout(() => {
      mpv.command('seek', [String(initialPosition), 'absolute']);
    }, INITIAL_SEEK_DELAY);
  }
  
  startPlaybackTracking(id, type);
}

function startPlaybackTracking(id, type) {
  if (playbackTracker) clearInterval(playbackTracker);
  
  Logger.log('Starting playback tracking');
  playbackTracker = setInterval(() => {
    saveProgress(id, type);
  }, SAVE_INTERVAL);
}

function saveProgress(id, type) {
  try {
    const pos = mpv.getNumber('time-pos');
    const dur = mpv.getNumber('duration');
    
    if (pos > 10 && dur > 0) {
      // Only save if meaningful progress
      storage.saveResumePosition(id, type, pos, dur);
    }
  } catch (e) {
    // MPV might not be ready or file closed
  }
}

function stopPlaybackTracking() {
  if (playbackTracker) {
    clearInterval(playbackTracker);
    playbackTracker = null;
  }
}

// ============================================================================
// IINA Events
// ============================================================================

function registerIinaEvents() {
  event.on('mpv.end-file', () => {
    Logger.log('Playback ended');
    if (state.currentStream) {
      saveProgress(state.currentStream.id, state.currentStream.type);
    }
    stopPlaybackTracking();
    state.currentStream = null;
    isWindowLoaded = false;
  });
  
  event.on('iina.window-will-close', () => {
    Logger.log('Window closing, saving state');
    if (state.currentStream) {
      saveProgress(state.currentStream.id, state.currentStream.type);
    }
    isWindowLoaded = false;
  });
}

// Start
init();
registerInputHandlers();
