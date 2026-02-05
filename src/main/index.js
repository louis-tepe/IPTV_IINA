/**
 * IINA IPTV Plugin - Main Window Entry Point
 * Polls for play requests from global.js via preferences
 * Tracks playback progress for resume functionality
 */

iina.console.log('[IPTV] Main loaded - Starting preferences polling');

// Configuration
var POLL_INTERVAL = 500; // Check every 500ms
var POSITION_SAVE_INTERVAL = 10000; // Save position every 10 seconds
var lastProcessedTimestamp = 0;
var currentStreamId = null;
var currentStreamType = null;
var positionSaveTimer = null;

// CRITICAL FIX: Initialize the preference key at startup to prevent
// IINA from logging "Trying to get preference value for undefined key"
// errors every 500ms, which was saturating the Main Thread.
try {
  iina.preferences.set('iptv_play_request', null);
  iina.console.log('[IPTV Main] ✓ Preference key iptv_play_request initialized');
} catch (e) {
  iina.console.error('[IPTV Main] Failed to initialize preference key: ' + e.message);
}

/**
 * Check for play requests from global.js
 */
function checkForPlayRequest() {
  try {
    var playRequestStr = iina.preferences.get('iptv_play_request');
    
    if (!playRequestStr) {
      return; // No request pending
    }
    
    var playRequest = JSON.parse(playRequestStr);
    
    // Check if this is a new request (avoid playing same request twice)
    if (playRequest.timestamp && playRequest.timestamp > lastProcessedTimestamp) {
      iina.console.log('[IPTV Main] New play request found: ' + JSON.stringify(playRequest));
      
      // Update timestamp BEFORE playing to avoid race conditions
      lastProcessedTimestamp = playRequest.timestamp;
      
      // Clear the request from preferences
      iina.preferences.set('iptv_play_request', null);
      
      // Store current stream info for tracking
      currentStreamId = playRequest.streamId || null;
      currentStreamType = playRequest.type || null;
      
      // Play the stream
      playStream(playRequest.url, playRequest.name, playRequest.type, playRequest.resumePosition);
    }
  } catch (e) {
    iina.console.error('[IPTV Main] Error checking play request: ' + e.message);
  }
}

/**
 * Play a stream using available APIs
 * @param {string} url - Stream URL
 * @param {string} name - Stream name
 * @param {string} type - Stream type (live, vod, series)
 * @param {number} [resumePosition] - Optional position to resume from (in seconds)
 */
function playStream(url, name, type, resumePosition) {
  iina.console.log('[IPTV Main] Playing stream: ' + name + ' (' + type + ')');
  iina.console.log('[IPTV Main] URL: ' + url);
  if (resumePosition) {
    iina.console.log('[IPTV Main] Resume position: ' + resumePosition + 's');
  }
  
  // Clear any existing position save timer
  if (positionSaveTimer) {
    clearInterval(positionSaveTimer);
    positionSaveTimer = null;
  }
  
  try {
    // Method 1: Try iina.core.open() first
    if (typeof iina.core !== 'undefined' && typeof iina.core.open === 'function') {
      iina.core.open(url);
      iina.console.log('[IPTV Main] ✅ Video opened via iina.core.open()');
      
      // Start tracking playback progress
      startPlaybackTracking(resumePosition);
      return;
    }
    
    // Method 2: Fallback to iina.playlist
    if (typeof iina.playlist !== 'undefined') {
      iina.playlist.add(url);
      var items = iina.playlist.items;
      iina.playlist.playAt(items.length - 1);
      iina.console.log('[IPTV Main] ✅ Video opened via iina.playlist');
      
      // Start tracking playback progress
      startPlaybackTracking(resumePosition);
      return;
    }
    
    // Method 3: Final fallback to mpv
    if (typeof iina.mpv !== 'undefined' && typeof iina.mpv.command === 'function') {
      iina.mpv.command('loadfile', [url]);
      iina.console.log('[IPTV Main] ✅ Video opened via iina.mpv.command()');
      
      // Start tracking playback progress
      startPlaybackTracking(resumePosition);
      return;
    }
    
    iina.console.error('[IPTV Main] ❌ No playback API available');
  } catch (e) {
    iina.console.error('[IPTV Main] ❌ Error opening video: ' + e.message);
    iina.console.error('[IPTV Main] Stack: ' + (e.stack || 'no stack'));
  }
}

/**
 * Start tracking playback progress for resume functionality
 * @param {number} [initialPosition] - Optional initial position to seek to
 */
function startPlaybackTracking(initialPosition) {
  iina.console.log('[IPTV Main] Starting playback tracking');
  
  // Seek to initial position if provided (resume functionality)
  if (initialPosition && initialPosition > 0) {
    setTimeout(function() {
      try {
        if (typeof iina.mpv !== 'undefined' && typeof iina.mpv.command === 'function') {
          iina.mpv.command('seek', [String(initialPosition), 'absolute']);
          iina.console.log('[IPTV Main] ✅ Resumed from position: ' + initialPosition + 's');
        }
      } catch (e) {
        iina.console.error('[IPTV Main] Failed to seek to resume position: ' + e.message);
      }
    }, 500); // Wait 500ms for video to start loading
  }
  
  // Set up periodic position saving
  positionSaveTimer = setInterval(function() {
    saveCurrentPosition();
  }, POSITION_SAVE_INTERVAL);
  
  iina.console.log('[IPTV Main] Position tracking started (saving every ' + (POSITION_SAVE_INTERVAL/1000) + 's)');
}

/**
 * Save current playback position to preferences
 * This is called periodically during playback
 */
function saveCurrentPosition() {
  if (!currentStreamId) {
    return; // No active stream to track
  }
  
  try {
    var position = 0;
    var duration = 0;
    
    // Get current position from mpv
    if (typeof iina.mpv !== 'undefined' && typeof iina.mpv.getNumber === 'function') {
      position = iina.mpv.getNumber('time-pos') || 0;
      duration = iina.mpv.getNumber('duration') || 0;
    }
    
    // Only save if we have meaningful data
    if (position > 0 && duration > 0) {
      var resumeData = {
        streamId: currentStreamId,
        type: currentStreamType,
        position: Math.floor(position),
        duration: Math.floor(duration),
        updatedAt: Date.now()
      };
      
      iina.preferences.set('iptv_current_resume', JSON.stringify(resumeData));
      iina.console.log('[IPTV Main] Position saved: ' + Math.floor(position) + 's / ' + Math.floor(duration) + 's');
    }
  } catch (e) {
    iina.console.error('[IPTV Main] Error saving position: ' + e.message);
  }
}

/**
 * Clear resume position when playback ends
 */
function clearResumePosition() {
  if (currentStreamId) {
    try {
      iina.preferences.set('iptv_current_resume', null);
      iina.console.log('[IPTV Main] Resume position cleared for: ' + currentStreamId);
    } catch (e) {
      iina.console.error('[IPTV Main] Error clearing resume position: ' + e.message);
    }
  }
}

/**
 * Handle file loaded event
 */
function onFileLoaded() {
  iina.console.log('[IPTV Main] File loaded event received');
  // Reset position tracking when a new file loads
  if (positionSaveTimer) {
    clearInterval(positionSaveTimer);
  }
  startPlaybackTracking();
}

/**
 * Handle playback end event
 */
function onPlaybackEnd() {
  iina.console.log('[IPTV Main] Playback end event received');
  if (positionSaveTimer) {
    clearInterval(positionSaveTimer);
    positionSaveTimer = null;
  }
  clearResumePosition();
  currentStreamId = null;
  currentStreamType = null;
}

// Set up event listeners for playback tracking
if (typeof iina.event !== 'undefined') {
  iina.event.on('iina.file-loaded', onFileLoaded);
  iina.event.on('mpv.end-file', onPlaybackEnd);
  iina.console.log('[IPTV Main] ✓ Event listeners registered for playback tracking');
} else {
  iina.console.warn('[IPTV Main] iina.event not available - playback tracking limited');
}

// Start polling
iina.console.log('[IPTV Main] Starting polling loop (interval: ' + POLL_INTERVAL + 'ms)');
setInterval(checkForPlayRequest, POLL_INTERVAL);

iina.console.log('[IPTV Main] Initialization complete - Waiting for play requests from global.js');
