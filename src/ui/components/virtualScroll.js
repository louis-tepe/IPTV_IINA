/**
 * IINA IPTV Plugin - Virtual Scrolling Component
 * v8.0.0
 * 
 * Virtual scrolling for large lists (>50 items) - smooth 60fps with 1000+ items
 */

'use strict';

/**
 * Virtual scrolling state
 * @type {Object}
 */
const virtualScrollState = {
  enabled: false,
  allItems: [],
  visibleStart: 0,
  visibleEnd: 0,
  itemHeight: 120,
  bufferSize: 5,
  containerHeight: 0,
  totalHeight: 0,
  scrollTop: 0,
  cacheKey: null
};

/**
 * Initialize virtual scrolling for large lists
 * @param {Array} items - Full list of items
 * @param {Object} config - Virtual scroll configuration
 * @param {HTMLElement} listEl - List element
 * @param {Function} renderCallback - Callback to render items
 * @returns {boolean} True if virtual scroll was initialized
 */
function initVirtualScroll(items, config, listEl, renderCallback) {
  if (!items || items.length <= (config.threshold || 50)) {
    virtualScrollState.enabled = false;
    return false;
  }
  
  if (!listEl) return false;
  
  // Calculate container height
  const containerRect = listEl.parentElement.getBoundingClientRect();
  virtualScrollState.containerHeight = containerRect.height || 600;
  
  // Store all items
  virtualScrollState.allItems = items;
  virtualScrollState.itemHeight = config.itemHeight || 120;
  virtualScrollState.bufferSize = config.bufferSize || 5;
  virtualScrollState.enabled = true;
  virtualScrollState.cacheKey = config.cacheKey || null;
  
  // Calculate total height
  virtualScrollState.totalHeight = items.length * virtualScrollState.itemHeight;
  
  // Clear existing content and set up virtual container
  listEl.innerHTML = '';
  listEl.className = 'content-grid virtual-scroll-container';
  
  // Create spacer for total height
  const spacerTop = document.createElement('div');
  spacerTop.className = 'virtual-scroll-spacer-top';
  spacerTop.style.height = '0px';
  listEl.appendChild(spacerTop);
  
  // Create visible items container
  const visibleContainer = document.createElement('div');
  visibleContainer.className = 'virtual-scroll-visible';
  listEl.appendChild(visibleContainer);
  
  // Create bottom spacer
  const spacerBottom = document.createElement('div');
  spacerBottom.className = 'virtual-scroll-spacer-bottom';
  spacerBottom.style.height = (virtualScrollState.totalHeight - virtualScrollState.containerHeight) + 'px';
  listEl.appendChild(spacerBottom);
  
  // Add scroll listener
  const scrollHandler = () => handleVirtualScroll(listEl, renderCallback);
  listEl.parentElement.addEventListener('scroll', scrollHandler, { passive: true });
  
  // Store scroll handler for cleanup
  virtualScrollState.scrollHandler = scrollHandler;
  
  // Initial render
  updateVirtualScroll(listEl, renderCallback);
  
  return true;
}

/**
 * Handle virtual scroll events
 * @param {HTMLElement} listEl - List element
 * @param {Function} renderCallback - Callback to render items
 */
function handleVirtualScroll(listEl, renderCallback) {
  if (!virtualScrollState.enabled) return;
  
  if (!listEl) return;
  
  // Use requestAnimationFrame for smooth performance
  requestAnimationFrame(() => {
    updateVirtualScroll(listEl, renderCallback);
  });
}

/**
 * Update visible items in virtual scroll
 * @param {HTMLElement} listEl - List element
 * @param {Function} renderCallback - Callback to render items
 */
function updateVirtualScroll(listEl, renderCallback) {
  if (!virtualScrollState.enabled) return;
  
  if (!listEl) return;
  
  const scrollTop = listEl.parentElement.scrollTop;
  const { itemHeight, bufferSize, allItems, containerHeight } = virtualScrollState;
  
  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
  const visibleCount = Math.ceil(containerHeight / itemHeight) + (bufferSize * 2);
  const endIndex = Math.min(startIndex + visibleCount, allItems.length);
  
  // Only update if range changed significantly
  if (Math.abs(startIndex - virtualScrollState.visibleStart) < 2 && 
      Math.abs(endIndex - virtualScrollState.visibleEnd) < 2) {
    return;
  }
  
  virtualScrollState.visibleStart = startIndex;
  virtualScrollState.visibleEnd = endIndex;
  virtualScrollState.scrollTop = scrollTop;
  
  // Update spacers
  const spacerTop = listEl.querySelector('.virtual-scroll-spacer-top');
  const spacerBottom = listEl.querySelector('.virtual-scroll-spacer-bottom');
  const visibleContainer = listEl.querySelector('.virtual-scroll-visible');
  
  if (spacerTop) spacerTop.style.height = (startIndex * itemHeight) + 'px';
  if (spacerBottom) {
    const bottomHeight = ((allItems.length - endIndex) * itemHeight);
    spacerBottom.style.height = Math.max(0, bottomHeight) + 'px';
  }
  
  // Render visible items
  if (visibleContainer && renderCallback) {
    const itemsToRender = allItems.slice(startIndex, endIndex);
    renderCallback(itemsToRender, startIndex, visibleContainer);
  }
}

/**
 * Clean up virtual scrolling
 * @param {HTMLElement} listEl - List element
 */
function cleanupVirtualScroll(listEl) {
  if (!virtualScrollState.enabled) return;
  
  if (listEl && listEl.parentElement && virtualScrollState.scrollHandler) {
    listEl.parentElement.removeEventListener('scroll', virtualScrollState.scrollHandler);
  }
  
  virtualScrollState.enabled = false;
  virtualScrollState.allItems = [];
  virtualScrollState.visibleStart = 0;
  virtualScrollState.visibleEnd = 0;
  virtualScrollState.scrollHandler = null;
}

/**
 * Get virtual scroll state
 * @returns {Object} Current virtual scroll state
 */
function getVirtualScrollState() {
  return virtualScrollState;
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initVirtualScroll,
    handleVirtualScroll,
    updateVirtualScroll,
    cleanupVirtualScroll,
    getVirtualScrollState
  };
}