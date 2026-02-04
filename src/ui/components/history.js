/**
 * IINA IPTV Plugin - History Component
 * v8.0.0
 * 
 * Enhanced history rendering with thumbnails and timestamps
 */

'use strict';

/**
 * Enhanced history rendering with thumbnails and timestamps
 * @param {Array} historyItems - History items array
 * @param {HTMLElement} listEl - List element
 * @param {Function} escapeHtml - Escape HTML function
 * @param {Function} getRelativeTime - Get relative time function
 * @param {Function} loadSeriesInfoCallback - Callback to load series info
 * @param {Function} playStreamCallback - Callback to play stream
 */
function renderHistoryItems(historyItems, listEl, escapeHtml, getRelativeTime, loadSeriesInfoCallback, playStreamCallback) {
  if (!listEl) return;
  
  // Apply history view class for proper styling
  listEl.className = 'history-view';
  
  const fragment = document.createDocumentFragment();
  
  historyItems.forEach((item, index) => {
    if (!item) return;
    
    const name = escapeHtml(item.name || 'Unknown');
    const id = item.id || item.stream_id || item.series_id || index;
    const ext = item.container_extension || 'ts';
    const type = item.type || 'unknown';
    const thumbnail = item.thumbnail || item.stream_icon || item.cover || '';
    const playedAt = item.playedAt || Date.now();
    
    // Format timestamp
    const date = new Date(playedAt);
    const timeStr = date.toLocaleString();
    const relativeTime = getRelativeTime(playedAt);
    
    const card = document.createElement('div');
    card.className = 'history-card';
    card.setAttribute('data-id', id);
    card.setAttribute('data-ext', ext);
    card.setAttribute('data-name', name);
    card.setAttribute('data-type', type);
    
    let thumbnailHtml;
    if (thumbnail) {
      thumbnailHtml = `<img src="${thumbnail}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
    } else {
      thumbnailHtml = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="2" y="2" width="20" height="20" rx="2"/>
          <circle cx="12" cy="12" r="4"/>
        </svg>
      `;
    }
    
    card.innerHTML = `
      <div class="history-thumbnail">
        ${thumbnailHtml}
        <div class="history-thumbnail-placeholder" style="${thumbnail ? 'display:none;' : ''}">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="2" y="2" width="20" height="20" rx="2"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
        </div>
      </div>
      <div class="history-info">
        <div class="history-title">${name}</div>
        <div class="history-meta">
          <span class="history-type-badge">${type.toUpperCase()}</span>
          <span class="history-timestamp">${relativeTime}</span>
        </div>
        <div class="history-timestamp" title="${timeStr}">${timeStr}</div>
      </div>
    `;
    
    // Click to play - Use series_id if available for episodes
    card.addEventListener('click', () => {
      if (type === 'series') {
        // If this history item has a series_id, use it to load series info
        if (item.series_id) {
          loadSeriesInfoCallback(item.series_id, name);
        } else {
          // This is a series entry itself (not an episode)
          loadSeriesInfoCallback(id, name);
        }
      } else {
        // For live/vod streams, play directly
        playStreamCallback(id, ext, name, type);
      }
    });
    
    fragment.appendChild(card);
  });
  
  listEl.innerHTML = '';
  listEl.appendChild(fragment);
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderHistoryItems
  };
}