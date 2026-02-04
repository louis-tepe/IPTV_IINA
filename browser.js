/**
 * IINA IPTV Plugin - Browser UI Controller (Refactored)
 * v8.0.0 - Modularized Version
 *
 * This file now serves as a simple loader that imports the modularized app.js
 * All actual logic has been moved to src/ui/ modules:
 * - src/ui/app.js - Main application logic
 * - src/ui/utils/i18n.js - Translation system
 * - src/ui/utils/dom.js - DOM utilities
 * - src/ui/utils/debug.js - Debug utilities
 * - src/ui/components/virtualScroll.js - Virtual scrolling
 * - src/ui/components/imageLoader.js - Image lazy loading
 * - src/ui/components/series.js - Series rendering
 * - src/ui/components/history.js - History rendering
 * - src/ui/components/epg.js - EPG rendering
 *
 * This refactoring reduces browser.js from 2283 lines to < 50 lines
 * while maintaining full backward compatibility.
 */

'use strict';

// Import the main app module
// Note: This will be bundled by Parcel
require('./src/ui/app.js');
