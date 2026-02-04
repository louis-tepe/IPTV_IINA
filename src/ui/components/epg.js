/**
 * IINA IPTV Plugin - EPG Component
 * v8.0.0
 * 
 * Electronic Program Guide (EPG) rendering
 */

'use strict';

/**
 * Show EPG modal
 * @param {string} streamId - Stream ID
 * @param {string} streamName - Stream name
 * @param {HTMLElement} epgModalEl - EPG modal element
 * @param {HTMLElement} epgContentEl - EPG content element
 * @param {Function} sendMessageCallback - Callback to send message to backend
 * @param {Function} debug - Debug function
 */
function showEpg(streamId, streamName, epgModalEl, epgContentEl, sendMessageCallback, debug) {
  if (!epgModalEl || !epgContentEl) {
    debug('EPG modal elements not found', 'error');
    return;
  }
  
  epgContentEl.innerHTML = `
    <div class="epg-loading">
      <div class="spinner"></div>
      <p>Loading program guide...</p>
    </div>
  `;
  epgModalEl.hidden = false;
  
  // Request EPG data from plugin
  sendMessageCallback('getEpg', { streamId: streamId });
  
  // Store current stream name for display
  epgModalEl.setAttribute('data-stream-name', streamName);
}

/**
 * Render EPG data
 * @param {Object} data - EPG data
 * @param {HTMLElement} epgContentEl - EPG content element
 * @param {HTMLElement} epgModalEl - EPG modal element
 * @param {Function} escapeHtml - Escape HTML function
 * @param {Function} debug - Debug function
 */
function renderEpg(data, epgContentEl, epgModalEl, escapeHtml, debug) {
  if (!epgContentEl) {
    debug('EPG content element not found', 'error');
    return;
  }
  
  const streamName = epgModalEl ? epgModalEl.getAttribute('data-stream-name') : '';
  
  if (!data || data.error) {
    debug('ERROR: Failed to render EPG - ' + (data ? data.error : 'Unknown error'), 'error');
    epgContentEl.innerHTML = `
      <div class="epg-error">
        <p>Failed to load program guide</p>
        <p class="epg-error-detail">${data ? data.error : 'Unknown error'}</p>
      </div>
    `;
    return;
  }
  
  const programs = data.data || [];
  
  if (!Array.isArray(programs) || programs.length === 0) {
    epgContentEl.innerHTML = `
      <div class="epg-empty">
        <p>No program information available</p>
      </div>
    `;
    return;
  }
  
  let html = `<h3>${escapeHtml(streamName)}</h3><div class="epg-list">`;
  
  programs.forEach(program => {
    const title = escapeHtml(program.title || program.name || 'Unknown Program');
    const description = escapeHtml(program.description || program.plot || '');
    const startTime = program.start || '';
    const endTime = program.end || '';
    
    html += `
      <div class="epg-item">
        <div class="epg-time">${startTime} - ${endTime}</div>
        <div class="epg-title">${title}</div>
        ${description ? `<div class="epg-desc">${description}</div>` : ''}
      </div>
    `;
  });
  
  html += '</div>';
  epgContentEl.innerHTML = html;
  
  debug(`EPG rendered: ${programs.length} programs`);
}

/**
 * Setup EPG modal close handler
 * @param {HTMLElement} epgCloseEl - EPG close button element
 * @param {HTMLElement} epgModalEl - EPG modal element
 */
function setupEpgCloseHandler(epgCloseEl, epgModalEl) {
  if (epgCloseEl) {
    epgCloseEl.addEventListener('click', () => {
      if (epgModalEl) epgModalEl.hidden = true;
    });
  }
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showEpg,
    renderEpg,
    setupEpgCloseHandler
  };
}