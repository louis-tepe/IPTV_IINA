/**
 * IINA IPTV Plugin - Image Loader Component
 * v8.0.0
 * 
 * Intersection Observer for lazy image loading - reduced memory usage
 */

'use strict';

/** @type {IntersectionObserver} Image observer instance */
let imageObserver = null;

/** @type {Set<string>} Set of loaded image URLs */
const loadedImages = new Set();

/**
 * Initialize Intersection Observer for lazy image loading
 * @param {HTMLElement} listEl - List element (used as root)
 */
function initImageObserver(listEl) {
  // Clean up existing observer
  if (imageObserver) {
    imageObserver.disconnect();
  }
  
  // Create new observer
  imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        loadImage(img);
        imageObserver.unobserve(img);
      }
    });
  }, {
    root: listEl?.parentElement || null,
    rootMargin: '100px 0px', // Load images 100px before they come into view
    threshold: 0.01
  });
  
  // Observe all lazy images
  const lazyImages = document.querySelectorAll('.lazy-image');
  lazyImages.forEach(img => {
    if (!loadedImages.has(img.dataset.src)) {
      imageObserver.observe(img);
    }
  });
}

/**
 * Load an image with error handling
 * @param {HTMLImageElement} img - Image element to load
 */
function loadImage(img) {
  const src = img.dataset.src;
  if (!src || loadedImages.has(src)) return;
  
  // Mark as loaded to prevent duplicate requests
  loadedImages.add(src);
  
  // Set up load handlers
  img.onload = () => {
    img.classList.add('loaded');
  };
  
  img.onerror = () => {
    // Show placeholder on error
    img.style.display = 'none';
    const placeholder = img.nextElementSibling;
    if (placeholder && placeholder.classList.contains('image-placeholder')) {
      placeholder.style.display = 'flex';
    }
  };
  
  // Start loading
  img.src = src;
}

/**
 * Disconnect image observer
 */
function disconnectImageObserver() {
  if (imageObserver) {
    imageObserver.disconnect();
    imageObserver = null;
  }
}

/**
 * Check if an image URL has been loaded
 * @param {string} src - Image URL
 * @returns {boolean} True if image has been loaded
 */
function isImageLoaded(src) {
  return loadedImages.has(src);
}

/**
 * Clear loaded images cache
 */
function clearLoadedImagesCache() {
  loadedImages.clear();
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initImageObserver,
    loadImage,
    disconnectImageObserver,
    isImageLoaded,
    clearLoadedImagesCache
  };
}