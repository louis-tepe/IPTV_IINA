/**
 * IINA IPTV Plugin - Fullscreen Browser UI Controller
 * v8.0.0
 */

'use strict';

(function() {
  'use strict';
  
  // State
  var currentType = 'live';
  var isShowingStreams = false;
  var currentCategoryName = '';
  var config = null;
  
  // DOM
  var backBtn = document.getElementById('back-btn');
  var loadingEl = document.getElementById('loading');
  var emptyEl = document.getElementById('empty');
  var emptyMsg = document.getElementById('empty-message');
  var categoriesView = document.getElementById('categories-view');
  var categoriesGrid = document.getElementById('categories-grid');
  var categoryCount = document.getElementById('category-count');
  var streamsView = document.getElementById('streams-view');
  var streamsGrid = document.getElementById('streams-grid');
  var streamsTitle = document.getElementById('streams-title');
  var tabs = document.querySelectorAll('.nav-tab');
  
  function log(msg) {
    console.log('[FullBrowser] ' + msg);
  }
  
  function showLoading() {
    loadingEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    categoriesView.classList.add('hidden');
    streamsView.classList.add('hidden');
  }
  
  function hideLoading() {
    loadingEl.classList.add('hidden');
  }
  
  function showEmpty(msg) {
    hideLoading();
    emptyEl.classList.remove('hidden');
    emptyMsg.textContent = msg || 'Aucun contenu trouvé';
    categoriesView.classList.add('hidden');
    streamsView.classList.add('hidden');
  }
  
  function showCategories() {
    isShowingStreams = false;
    backBtn.classList.add('hidden');
    categoriesView.classList.remove('hidden');
    streamsView.classList.add('hidden');
  }
  
  function showStreams(categoryName) {
    isShowingStreams = true;
    currentCategoryName = categoryName;
    backBtn.classList.remove('hidden');
    categoriesView.classList.add('hidden');
    streamsView.classList.remove('hidden');
    streamsTitle.textContent = categoryName;
  }
  
  function getIcon(type) {
    return type === 'live' ? '📺' : type === 'vod' ? '🎬' : '📚';
  }
  
  function renderCategories(data) {
    hideLoading();
    showCategories();
    
    if (!data || data.length === 0) {
      showEmpty('Aucune catégorie trouvée');
      return;
    }
    
    categoryCount.textContent = '(' + data.length + ')';
    
    categoriesGrid.innerHTML = data.map(function(cat) {
      var name = cat.category_name || cat.name || 'Inconnu';
      var id = cat.category_id || cat.id;
      return '<div class="category-card" data-id="' + id + '" data-name="' + name.replace(/"/g, '&quot;') + '">' +
        '<div class="category-card-icon">' + getIcon(currentType) + '</div>' +
        '<div class="category-card-name">' + name + '</div>' +
      '</div>';
    }).join('');
    
    categoriesGrid.querySelectorAll('.category-card').forEach(function(el) {
      el.addEventListener('click', function() {
        var id = el.getAttribute('data-id');
        var name = el.getAttribute('data-name');
        loadStreams(id, name);
      });
    });
    
    log('Rendered ' + data.length + ' categories');
  }
  
  function renderStreams(data, categoryName) {
    hideLoading();
    showStreams(categoryName);
    
    if (!data || data.length === 0) {
      showEmpty('Aucun contenu dans cette catégorie');
      return;
    }
    
    streamsGrid.innerHTML = data.map(function(stream) {
      var name = stream.name || 'Inconnu';
      var id = stream.stream_id || stream.series_id || stream.id;
      var poster = stream.stream_icon || stream.cover || '';
      var year = stream.year || '';
      var rating = stream.rating || '';
      
      var posterHtml = poster 
        ? '<img src="' + poster + '" alt="" loading="lazy" onerror="this.outerHTML=\'<div class=placeholder>' + getIcon(currentType) + '</div>\'">'
        : '<div class="placeholder">' + getIcon(currentType) + '</div>';
      
      var metaHtml = '';
      if (year) metaHtml += year;
      if (rating) metaHtml += (metaHtml ? ' • ' : '') + '⭐ ' + rating;
      
      return '<div class="card" data-id="' + id + '" data-name="' + name.replace(/"/g, '&quot;') + '">' +
        '<div class="card-poster">' + posterHtml + '</div>' +
        '<div class="card-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>' +
        '<div class="card-info">' +
          '<div class="card-title">' + name + '</div>' +
          (metaHtml ? '<div class="card-meta">' + metaHtml + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    
    streamsGrid.querySelectorAll('.card').forEach(function(el) {
      el.addEventListener('click', function() {
        var id = el.getAttribute('data-id');
        var name = el.getAttribute('data-name');
        playStream(id, name);
      });
    });
    
    log('Rendered ' + data.length + ' streams');
  }
  
  function loadCategories() {
    showLoading();
    log('Requesting ' + currentType + ' categories');
    
    if (typeof iina !== 'undefined' && iina.postMessage) {
      iina.postMessage('browser_getCategories', { type: currentType });
    } else {
      showEmpty('Plugin non connecté');
    }
  }
  
  function loadStreams(categoryId, categoryName) {
    showLoading();
    log('Requesting streams for: ' + categoryName);
    
    if (typeof iina !== 'undefined' && iina.postMessage) {
      iina.postMessage('browser_getStreams', {
        type: currentType,
        categoryId: categoryId,
        categoryName: categoryName
      });
    }
  }
  
  function playStream(id, name) {
    log('Playing: ' + name);
    
    if (typeof iina !== 'undefined' && iina.postMessage) {
      iina.postMessage('browser_play', {
        id: id,
        name: name,
        type: currentType
      });
    }
  }
  
  // Event Handlers
  backBtn.addEventListener('click', function() {
    loadCategories();
  });
  
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentType = tab.getAttribute('data-type');
      loadCategories();
    });
  });
  
  // Message Handlers
  if (typeof iina !== 'undefined' && iina.onMessage) {
    iina.onMessage('browser_categories', function(data) {
      log('Received categories: ' + (data ? data.length : 0));
      renderCategories(data);
    });
    
    iina.onMessage('browser_streams', function(data) {
      log('Received streams');
      renderStreams(data.streams, data.categoryName);
    });
    
    iina.onMessage('browser_init', function(data) {
      log('Init received');
      config = data;
      if (data && data.configured) {
        loadCategories();
      } else {
        showEmpty('Veuillez configurer votre serveur IPTV');
      }
    });
    
    iina.onMessage('browser_error', function(data) {
      log('Error: ' + (data ? data.message : 'Unknown'));
      showEmpty(data ? data.message : 'Une erreur est survenue');
    });
    
    // HTTP Proxy Handler
    iina.onMessage('api_request', function(data) {
      log('API request: ' + data.requestId);
      
      fetch(data.url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      })
      .then(function(res) {
        return res.text().then(function(text) {
          return { statusCode: res.status, text: text };
        });
      })
      .then(function(result) {
        iina.postMessage('api_response', {
          requestId: data.requestId,
          success: true,
          statusCode: result.statusCode,
          text: result.text
        });
      })
      .catch(function(err) {
        iina.postMessage('api_response', {
          requestId: data.requestId,
          success: false,
          error: err.message
        });
      });
    });
  }
  
  // Initialize
  document.addEventListener('DOMContentLoaded', function() {
    log('Window loaded, sending ready signal');
    if (typeof iina !== 'undefined' && iina.postMessage) {
      iina.postMessage('browser_ready', {});
    }
  });
  
  if (document.readyState !== 'loading') {
    log('Document ready');
    if (typeof iina !== 'undefined' && iina.postMessage) {
      iina.postMessage('browser_ready', {});
    }
  }
})();
