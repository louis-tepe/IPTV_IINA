/**
 * Sidebar JavaScript
 * Handles all UI interactions within the IINA sidebar using Messaging API
 */

const state = {
  isConnected: false,
  currentTab: 'live',
  currentView: 'connection', // connection, categories, streams, series-detail
  currentCategory: null,
  currentSeries: null,
  searchQuery: ''
};

// ============================================
// IINA MESSAGING SETUP
// ============================================

// Listen for messages from Plugin
iina.onMessage('status', function(data) {
  // 'connected' or 'disconnected'
  if (data.connected) {
    state.isConnected = true;
    showMainScreen();
    // Load initial categories if needed, but plugin pushes data
    iina.postMessage('get_categories', { type: state.currentTab });
    
    // Update footer info
    if (data.serverName) document.getElementById('server-name').textContent = data.serverName;
    if (data.expiration) document.getElementById('account-info').textContent = 'Exp: ' + data.expiration;
  } else {
    state.isConnected = false;
    showConnectionScreen();
  }
});

iina.onMessage('categories', function(data) {
  renderCategories(data);
});

iina.onMessage('streams', function(data) {
  renderStreams(data, state.currentTab);
});

iina.onMessage('series_info', function(data) {
  renderSeriesDetail(data);
});

iina.onMessage('error', function(data) {
  const errEl = document.getElementById('connection-error');
  if (errEl) {
    errEl.textContent = data.message;
    errEl.hidden = false;
  }
  // Reset button state
  const btn = document.getElementById('connect-btn');
  btn.disabled = false;
  btn.querySelector('.btn-text').hidden = false;
  btn.querySelector('.btn-loading').hidden = true;
});

// ============================================
// UI LOGIC
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  setupConnectionForm();
  setupTabs();
  setupNavigation();
  
  // Ask for status
  iina.postMessage('check_status');
});

function setupConnectionForm() {
  const form = document.getElementById('connection-form');
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const server = document.getElementById('server').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const name = document.getElementById('name').value.trim();
    
    if (!server || !username || !password) return;
    
    // UI Loading
    const btn = document.getElementById('connect-btn');
    btn.disabled = true;
    btn.querySelector('.btn-text').hidden = true;
    btn.querySelector('.btn-loading').hidden = false;
    document.getElementById('connection-error').hidden = true;
    
    iina.postMessage('connect', { server, username, password, name });
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // UI
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const type = tab.dataset.tab;
      state.currentTab = type;
      
      // Request Data
      document.getElementById('loading').hidden = false;
      document.getElementById('content-grid').hidden = true;
      document.getElementById('series-detail').hidden = true;
      document.getElementById('breadcrumb').hidden = true;
      
      iina.postMessage('get_categories', { type });
    });
  });
}

function setupNavigation() {
  document.getElementById('back-btn').addEventListener('click', () => {
      // Simple back logic
      document.getElementById('series-detail').hidden = true;
      document.getElementById('breadcrumb').hidden = true;
      document.getElementById('content-grid').hidden = false;
      
      // If we were deep in streams, go back to categories?
      // For simplicity, we just reload categories of current tab
      iina.postMessage('get_categories', { type: state.currentTab });
  });
  
  document.getElementById('refresh-btn').addEventListener('click', () => {
      iina.postMessage('get_categories', { type: state.currentTab });
  });
  
  document.getElementById('settings-btn').addEventListener('click', () => {
      // Maybe logout?
      iina.postMessage('logout');
  });
}

function showConnectionScreen() {
  document.getElementById('connection-screen').hidden = false;
  document.getElementById('main-screen').hidden = true;
}

function showMainScreen() {
  document.getElementById('connection-screen').hidden = true;
  document.getElementById('main-screen').hidden = false;
}

// Rendering

function renderCategories(list) {
  document.getElementById('loading').hidden = true;
  document.getElementById('content-grid').hidden = false;
  const grid = document.getElementById('content-grid');
  
  if (!list || list.length === 0) {
    grid.innerHTML = '<div class="empty-state">No content</div>';
    return;
  }
  
  grid.innerHTML = list.map(c => `
    <div class="category-card" data-id="${c.category_id}" onclick="loadCategory('${c.category_id}', '${escapeHtml(c.category_name)}')">
      <div class="category-icon">📁</div>
      <div class="category-name">${escapeHtml(c.category_name)}</div>
    </div>
  `).join('');
}

window.loadCategory = function(id, name) {
  document.getElementById('loading').hidden = false;
  document.getElementById('content-grid').hidden = true;
  
  // Breadcrumb
  const bread = document.getElementById('breadcrumb');
  bread.hidden = false;
  document.getElementById('breadcrumb-text').textContent = name;
  
  iina.postMessage('get_streams', { category_id: id, type: state.currentTab });
};

function renderStreams(list, type) {
  document.getElementById('loading').hidden = true;
  document.getElementById('content-grid').hidden = false;
  const grid = document.getElementById('content-grid');
  
  if (!list || list.length === 0) {
    grid.innerHTML = '<div class="empty-state">No streams found</div>';
    return;
  }
  
  grid.innerHTML = list.map(item => {
    const id = item.stream_id || item.series_id;
    const name = item.name || item.title || 'Unknown';
    const icon = item.stream_icon || item.cover;
    const clickFn = type === 'series' ? `loadSeries('${id}')` : `playStream('${id}', '${item.container_extension}')`;
    
    return `
      <div class="stream-card" onclick="${clickFn}">
        <div class="stream-poster">
           ${icon ? `<img src="${icon}" onerror="this.style.display='none'">` : '<div class="placeholder">📺</div>'}
        </div>
        <div class="stream-info">
          <div class="stream-name">${escapeHtml(name)}</div>
        </div>
      </div>
    `;
  }).join('');
}

window.playStream = function(id, ext) {
  iina.postMessage('play', { id, ext, type: state.currentTab });
};

window.loadSeries = function(id) {
    document.getElementById('loading').hidden = false;
    document.getElementById('content-grid').hidden = true;
    iina.postMessage('get_series_info', { id });
};

function renderSeriesDetail(data) {
    document.getElementById('loading').hidden = true;
    document.getElementById('series-detail').hidden = false;
    
    // Quick render
    document.getElementById('series-info').innerHTML = `<h2>${escapeHtml(data.info.name)}</h2><p>${escapeHtml(data.info.plot)}</p>`;
    
    // Episodes
    let html = '';
    const episodes = data.episodes;
    // ... simplified rendering for episodes ...
    // Just a list for now
    for (let season in episodes) {
        html += `<h3>Season ${season}</h3>`;
        episodes[season].forEach(ep => {
            html += `<div class="episode-item" onclick="playStream('${ep.id}', '${ep.container_extension}')">
               ${ep.episode_num}. ${escapeHtml(ep.title)}
            </div>`;
        });
    }
    document.getElementById('seasons-list').innerHTML = html;
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
