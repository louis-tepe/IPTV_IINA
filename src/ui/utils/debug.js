/**
 * IINA IPTV Plugin - Frontend Debug Utilities
 * v8.0.0
 * 
 * Debug panel and logging utilities
 */

'use strict';

/** @const {boolean} DEBUG - Set to true to enable debug mode */
const DEBUG = false;

/** @type {number} Debug message counter */
let debugMsgCount = 0;

/** @type {boolean} Debug panel minimized state */
let debugMinimized = false;

/**
 * Log debug message to console (only when DEBUG is true)
 * @param {string} msg - Message to log
 * @param {string} type - Log type (log, error, warn, info, sent, received)
 * @param {HTMLElement} debugMsgCountEl - Optional debug message count element
 */
function debug(msg, type = 'log', debugMsgCountEl) {
  if (!DEBUG) return;
  
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[IPTV ${type.toUpperCase()}] ${timestamp} ${msg}`);
  
  // Minimal UI update - just keep message count
  if (debugMsgCountEl) {
    debugMsgCount++;
    debugMsgCountEl.textContent = `Msgs: ${debugMsgCount}`;
  }
}

/**
 * Update connection status display
 * @param {HTMLElement} connectionStatusEl - Connection status element
 * @param {string} status - 'connecting', 'connected', or 'error'
 * @param {string} message - Optional status message
 * @returns {boolean} Connection state
 */
function updateConnectionStatus(connectionStatusEl, status, message) {
  if (!connectionStatusEl) return false;
  
  connectionStatusEl.className = 'connection-status ' + status;
  
  switch (status) {
    case 'connected':
      connectionStatusEl.textContent = message || '● Connected';
      return true;
    case 'error':
      connectionStatusEl.textContent = message || '● Error';
      return false;
    case 'connecting':
    default:
      connectionStatusEl.textContent = message || '● Connecting';
      return false;
  }
}

/**
 * Clear debug logs
 * @param {HTMLElement} debugLogsEl - Debug logs element
 * @param {HTMLElement} debugMsgCountEl - Debug message count element
 */
function clearDebugLogs(debugLogsEl, debugMsgCountEl) {
  if (debugLogsEl) {
    debugLogsEl.innerHTML = '';
    debugMsgCount = 0;
    if (debugMsgCountEl) {
      debugMsgCountEl.textContent = 'Msgs: 0';
    }
    debug('Logs cleared', 'info', debugMsgCountEl);
  }
}

/**
 * Toggle debug panel minimized state
 * @param {HTMLElement} debugPanelEl - Debug panel element
 * @param {HTMLElement} debugToggleEl - Debug toggle button element
 * @returns {boolean} New minimized state
 */
function toggleDebugPanel(debugPanelEl, debugToggleEl) {
  if (!debugPanelEl) return debugMinimized;
  
  debugMinimized = !debugMinimized;
  debugPanelEl.classList.toggle('minimized', debugMinimized);
  
  if (debugToggleEl) {
    debugToggleEl.textContent = debugMinimized ? '▲' : '▼';
  }
  
  return debugMinimized;
}

/**
 * Setup debug panel event listeners
 * @param {HTMLElement} debugClearEl - Debug clear button element
 * @param {HTMLElement} debugToggleEl - Debug toggle button element
 * @param {HTMLElement} debugPanelEl - Debug panel element
 * @param {HTMLElement} debugLogsEl - Debug logs element
 * @param {HTMLElement} debugMsgCountEl - Debug message count element
 */
function setupDebugPanelListeners(debugClearEl, debugToggleEl, debugPanelEl, debugLogsEl, debugMsgCountEl) {
  if (debugClearEl) {
    debugClearEl.addEventListener('click', (e) => {
      e.stopPropagation();
      clearDebugLogs(debugLogsEl, debugMsgCountEl);
    });
  }
  
  if (debugToggleEl) {
    debugToggleEl.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDebugPanel(debugPanelEl, debugToggleEl);
    });
  }
  
  // Click header to toggle
  const debugHeader = document.querySelector('.debug-header');
  if (debugHeader) {
    debugHeader.addEventListener('click', (e) => {
      // Don't toggle if clicking buttons
      if (e.target.closest('.debug-btn')) return;
      toggleDebugPanel(debugPanelEl, debugToggleEl);
    });
  }
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEBUG,
    debug,
    updateConnectionStatus,
    clearDebugLogs,
    toggleDebugPanel,
    setupDebugPanelListeners
  };
}