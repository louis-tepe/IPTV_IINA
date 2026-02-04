const { LOG_PREFIX } = require('./core/state');
const { Logger } = require('./utils/helpers');

// ============================================================================
// Initialization
// ============================================================================

function init() {
  Logger.log('Initializing IPTV Menu (Modular v8.0.0)...');
  registerMenu();
}

// ============================================================================
// Actions
// ============================================================================

function openBrowser() {
  Logger.log('Opening Browser via fullscreen overlay...');
  
  try {
    // Signal main.js to open overlay via preferences
    iina.preferences.set('iptv_open_overlay', JSON.stringify({
      timestamp: Date.now()
    }));
    
    Logger.log('Signal sent to open IPTV overlay');
  } catch (e) {
    Logger.error(`Failed to send overlay signal: ${e.message}`);
  }
}

// ============================================================================
// Menu Registration
// ============================================================================

function registerMenu() {
  if (typeof iina.menu === 'undefined') {
    Logger.error('Menu API not available');
    return;
  }
  
  try {
    // Single entry point as requested
    iina.menu.addItem(iina.menu.item('IPTV Player', openBrowser));
    
    Logger.log('Menu item registered');
  } catch (e) {
    Logger.error(`Failed to register menu: ${e.message}`);
  }
}

init();
