/**
 * IINA IPTV Plugin - Main Window Entry Point
 * Receives play requests from global.js via event-driven communication
 * Tracks playback progress for resume functionality
 */

iina.console.log('[IPTV] Main loaded - Event-driven communication initialized');

// Configuration
var POSITION_SAVE_THRESHOLD = 5; // Save only if position changed by 5+ seconds
var POSITION_SAVE_THROTTLE = 5000; // Max 1 save per 5 seconds
var lastProcessedTimestamp = 0;
var currentStreamId = null;
var currentStreamType = null;
var lastSavedPosition = 0;
var lastSaveTime = 0;
var isTrackingPlayback = false;

/**
 * Handle play requests from global.js via event
 * @param {Object} data - Play request data
 */
function handlePlayRequest(data) {
  try {
    if (!data) {
      iina.console.error('[IPTV Main] Received empty play request');
      return;
    }
    
    // Check if this is a new request (avoid playing same request twice)
    if (data.timestamp && data.timestamp <= lastProcessedTimestamp) {
      iina.console.log('[IPTV Main] Duplicate play request ignored');
      return;
    }
    
    iina.console.log('[IPTV Main] New play request received: ' + JSON.stringify(data));
    
    // Update timestamp BEFORE playing to avoid race conditions
    lastProcessedTimestamp = data.timestamp;
    
    // Store current stream info for tracking
    currentStreamId = data.streamId || null;
    currentStreamType = data.type || null;
    
    // Play the stream
    playStream(data.url, data.name, data.type, data.resumePosition);
  } catch (e) {
    iina.console.error('[IPTV Main] Error handling play request: ' + e.message);
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
  iina.console.log('[IPTV Main] Starting playback tracking (event-driven)');

  // Seek to initial position if provided (resume functionality)
  if (initialPosition && initialPosition > 0) {
    setTimeout(function() {
      try {
        if (typeof iina.mpv !== 'undefined' && typeof iina.mpv.command === 'function') {
          iina.mpv.command('seek', [String(initialPosition), 'absolute']);
          iina.console.log('[IPTV Main] ✅ Resumed from position: ' + initialPosition + 's');
          lastSavedPosition = initialPosition;
        }
      } catch (e) {
        iina.console.error('[IPTV Main] Failed to seek to resume position: ' + e.message);
      }
    }, 500); // Wait 500ms for video to start loading
  }

  isTrackingPlayback = true;
  iina.console.log('[IPTV Main] ✓ Event-driven position tracking active');
}

/**
 * Save current playback position to preferences (with throttling)
 * This is called when position changes significantly
 * @param {number} [position] - Optional position to save (if not provided, will fetch from mpv)
 */
function saveCurrentPosition(position) {
  if (!currentStreamId) {
    return; // No active stream to track
  }

  // Throttling check
  var now = Date.now();
  if (now - lastSaveTime < POSITION_SAVE_THROTTLE) {
    return; // Skip save if we saved recently
  }

  try {
    var pos = position;
    var duration = 0;

    // Get current position from mpv if not provided
    if (pos === undefined) {
      if (typeof iina.mpv !== 'undefined' && typeof iina.mpv.getNumber === 'function') {
        pos = iina.mpv.getNumber('time-pos') || 0;
        duration = iina.mpv.getNumber('duration') || 0;
      }
    }

    // Only save if we have meaningful data and position changed significantly
    if (pos > 0 && Math.abs(pos - lastSavedPosition) > POSITION_SAVE_THRESHOLD) {
      var resumeData = {
        streamId: currentStreamId,
        type: currentStreamType,
        position: Math.floor(pos),
        duration: Math.floor(duration),
        updatedAt: now
      };

      iina.preferences.set('iptv_current_resume', JSON.stringify(resumeData));
      lastSavedPosition = pos;
      lastSaveTime = now;

      // Emit event to notify global.js
      try {
        iina.event.emit('iptv.resumePositionUpdated', {
          streamId: currentStreamId,
          position: Math.floor(pos),
          duration: Math.floor(duration),
          updatedAt: now
        });
        iina.console.log('[IPTV Main] Position saved & event emitted: ' + Math.floor(pos) + 's / ' + Math.floor(duration) + 's');
      } catch (emitErr) {
        iina.console.error('[IPTV Main] Failed to emit resumePositionUpdated event: ' + emitErr.message);
      }
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
  isTrackingPlayback = false;
  startPlaybackTracking();
}

/**
 * Handle time position change event from mpv
 * @param {number} newPosition - New playback position in seconds
 */
function onTimePositionChanged(newPosition) {
  if (!isTrackingPlayback || !currentStreamId) {
    return;
  }

  // Save only if position changed significantly (throttled)
  if (Math.abs(newPosition - lastSavedPosition) > POSITION_SAVE_THRESHOLD) {
    saveCurrentPosition(newPosition);
  }
}

/**
 * Handle playback end event
 */
function onPlaybackEnd() {
  iina.console.log('[IPTV Main] Playback end event received');
  isTrackingPlayback = false;

  // Final save before clearing
  saveCurrentPosition();

  clearResumePosition();
  currentStreamId = null;
  currentStreamType = null;
  lastSavedPosition = 0;
  lastSaveTime = 0;
}

/**
 * Handle window will close event (safety save)
 */
function onWindowWillClose() {
  iina.console.log('[IPTV Main] Window will close event received');

  // Final save before window closes
  if (isTrackingPlayback && currentStreamId) {
    saveCurrentPosition();
  }
}

// Set up event listeners for playback tracking and play requests
if (typeof iina.event !== 'undefined') {
  iina.event.on('iina.file-loaded', onFileLoaded);
  iina.event.on('mpv.end-file', onPlaybackEnd);
  iina.event.on('mpv.time-pos.changed', onTimePositionChanged);
  iina.event.on('iina.window-will-close', onWindowWillClose);
  iina.event.on('iptv.play', handlePlayRequest);
  iina.console.log('[IPTV Main] ✓ Event listeners registered (event-driven, no polling)');
} else {
  iina.console.error('[IPTV Main] iina.event not available - plugin cannot function');
}

iina.console.log('[IPTV Main] Initialization complete - Waiting for play requests from global.js');
