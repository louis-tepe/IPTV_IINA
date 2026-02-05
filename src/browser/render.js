import { state, elements } from './state.js';
import { showLoading, hideLoading, showEmpty } from './ui.js';

const MAX_ITEMS_ANIMATION = 50;

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function debug(msg, type = 'log') {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[IPTV Browser] ${msg}`);
  
  if (elements.debugLogs) {
    const div = document.createElement('div');
    div.className = `debug-log-entry ${type}`;
    div.innerHTML = `<span class="debug-log-timestamp">${timestamp}</span> ${escapeHtml(msg)}`;
    elements.debugLogs.appendChild(div);
    elements.debugLogs.scrollTop = elements.debugLogs.scrollHeight;
    
    while (elements.debugLogs.children.length > 200) {
      elements.debugLogs.removeChild(elements.debugLogs.firstChild);
    }
  }
}

export function setViewMode(isGrid) {
  if (!elements.list) return;
  if (isGrid) {
    elements.list.classList.add('content-grid');
    elements.list.classList.remove('content-details');
  } else {
    elements.list.classList.remove('content-grid');
    elements.list.classList.add('content-details');
  }
}

export function renderCategories(categories, loadCategoryCb) {
  hideLoading();
  
  if (!categories || !Array.isArray(categories)) {
    showEmpty('Invalid response from server');
    return;
  }
  
  if (categories.length === 0) {
    showEmpty('No categories found');
    return;
  }
  
  if (elements.empty) elements.empty.hidden = true;
  if (elements.list) elements.list.className = 'category-grid';
  
  const fragment = document.createDocumentFragment();
  
  categories.forEach((cat, index) => {
    if (!cat) return;
    
    const id = cat.category_id || cat.id;
    const name = escapeHtml(cat.category_name || cat.name || 'Unknown');
    if (!id) return;
    
    const card = document.createElement('div');
    card.className = 'category-card';
    card.setAttribute('data-id', id);
    
    let iconPath = 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z';
    const nameLower = name.toLowerCase();
    if (nameLower.includes('movie') || nameLower.includes('film')) {
      iconPath = 'M19.82 2H4.18C2.97 2 2 2.97 2 4.18v15.64C2 21.03 2.97 22 4.18 22h15.64c1.21 0 2.18-.97 2.18-2.18V4.18C22 2.97 21.03 2 19.82 2zM7 2v20M17 2v20M2 12h5M2 7h5M2 17h5M17 17h5M17 7h5M17 12h5';
    } else if (nameLower.includes('series') || nameLower.includes('tv')) {
      iconPath = 'M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z';
    }
    
    card.innerHTML = `
      <div class="category-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="${iconPath}"/>
        </svg>
      </div>
      <div class="category-info">
        <div class="category-name">${name}</div>
        <div class="category-count">Open</div>
      </div>
    `;
    
    card.addEventListener('click', () => loadCategoryCb(id, name));
    if (index < MAX_ITEMS_ANIMATION) card.style.animationDelay = `${index * 0.05}s`;
    fragment.appendChild(card);
  });
  
  if (elements.list) {
    elements.list.innerHTML = '';
    elements.list.appendChild(fragment);
  }
}

export function renderItems(list, type, callbacks) {
  hideLoading();
  if (type !== 'history' && elements.list) elements.list.className = 'content-grid';
  setViewMode(true);
  
  state.items = list;
  if (!list || list.length === 0) {
    showEmpty('No content found');
    return;
  }
  
  if (elements.empty) elements.empty.hidden = true;
  
  if (type === 'history') {
    renderHistoryItems(list, callbacks);
    return;
  }
  
  const fragment = document.createDocumentFragment();
  list.forEach((item, index) => {
    if (!item) return;
    const name = escapeHtml(item.name || item.title || 'Unknown');
    const id = item.stream_id || item.series_id || index;
    const ext = item.container_extension || 'ts';
    const poster = item.stream_icon || item.cover || '';
    const searchType = item.searchType || type;
    
    const card = document.createElement('div');
    card.className = 'stream-card';
    card.innerHTML = `
      <div class="stream-poster">
        ${poster ? `<img src="${poster}" loading="lazy" onerror="this.style.display='none'">` : '<div class="no-poster"></div>'}
      </div>
      <div class="stream-info"><div class="stream-name">${name}</div></div>
    `;
    
    card.addEventListener('click', () => {
       if (searchType === 'series' && callbacks.onSeriesClick) {
         callbacks.onSeriesClick(id, name);
       } else if (callbacks.onStreamClick) {
         callbacks.onStreamClick(id, ext, name, searchType);
       }
    });
    
    fragment.appendChild(card);
  });
  
  if (elements.list) {
    elements.list.innerHTML = '';
    elements.list.appendChild(fragment);
  }
}

function renderHistoryItems(historyItems, callbacks) {
    // Simplified history render for brevity
    if (elements.list) elements.list.className = 'history-view';
    const fragment = document.createDocumentFragment();
    
    historyItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.textContent = item.name || 'Unknown';
        card.addEventListener('click', () => {
             if (item.type === 'series' && callbacks.onSeriesClick) {
                 callbacks.onSeriesClick(item.series_id || item.stream_id, item.name);
             } else if (callbacks.onStreamClick) {
                 callbacks.onStreamClick(item.stream_id, item.container_extension, item.name, item.type);
             }
        });
        fragment.appendChild(card);
    });
    
    if (elements.list) {
        elements.list.innerHTML = '';
        elements.list.appendChild(fragment);
    }
}

export function renderSeriesDetails(data, callbacks) {
  // Ensure seasons exists
  if (!data.seasons) data.seasons = {};
  
  const { seriesId, name, cover, plot, seasons } = data;
  
  // Convert object format to array
  let seasonsArray = seasons;
  if (!Array.isArray(seasons) && typeof seasons === 'object' && seasons !== null) {
      seasonsArray = Object.keys(seasons).map(key => ({
          season_number: parseInt(key, 10),
          episodes: seasons[key]
      })).sort((a, b) => a.season_number - b.season_number);
  }
  const finalSeasons = Array.isArray(seasonsArray) ? seasonsArray : [];
  
  if (elements.list) elements.list.innerHTML = '';
  if (elements.breadcrumb) elements.breadcrumb.hidden = true;
  if (elements.breadcrumbTitle) elements.breadcrumbTitle.textContent = name || 'Series Details';
  
  const container = document.createElement('div');
  container.className = 'series-details-container';
  
  // Header
  const backdropUrl = data.backdrop_path || cover || '';
  let headerHtml = `
    <div class="series-header" style="background-image: url('${escapeHtml(backdropUrl)}');">
      <button class="btn-hero-back" id="hero-back-btn">
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      </button>
      <div class="series-header-content">
        <div class="series-poster">
          ${cover ? `<img src="${cover}" onerror="this.style.display='none'">` : ''}
        </div>
        <div class="series-info">
          <h2 class="series-title">${escapeHtml(name)}</h2>
          <div class="series-meta-row">
            ${data.rating ? `<div class="series-rating">★ ${data.rating}</div>` : ''}
            <div>${finalSeasons.length} Saisons</div>
          </div>
          <p class="series-plot">${escapeHtml(plot || '')}</p>
        </div>
      </div>
    </div>
  `;
  
  // Seasons
  let seasonsHtml = '<div class="seasons-section"><div class="seasons-selector"><div class="seasons-list">';
  finalSeasons.forEach((season, index) => {
      const num = season.season_number || (index + 1);
      seasonsHtml += `<button class="season-btn ${index === 0 ? 'active' : ''}" data-index="${index}">Saison ${num}</button>`;
  });
  seasonsHtml += '</div></div></div>';
  
  // Episodes
  const episodesHtml = '<div class="episodes-container"><h3>Épisodes</h3><div class="episodes-list"></div></div>';
  
  container.innerHTML = headerHtml + seasonsHtml + episodesHtml;
  if (elements.list) elements.list.appendChild(container);
  
  // Render first season episodes
  if (finalSeasons.length > 0) {
      renderEpisodesList(finalSeasons[0].episodes || [], callbacks);
  }
  
  // Listeners
  const seasonBtns = container.querySelectorAll('.season-btn');
  seasonBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          seasonBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const index = parseInt(btn.getAttribute('data-index'), 10);
          if (finalSeasons[index]) renderEpisodesList(finalSeasons[index].episodes || [], callbacks);
      });
  });
  
  const backBtn = container.querySelector('#hero-back-btn');
  if (backBtn && callbacks.onBack) {
      backBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          callbacks.onBack();
      });
  }
}

function renderEpisodesList(episodes, callbacks) {
    const list = document.querySelector('.episodes-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (!episodes || episodes.length === 0) {
        list.innerHTML = '<p>Aucun épisode disponible</p>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    episodes.forEach((ep, index) => {
        const title = ep.title || `Épisode ${ep.episode_num || index + 1}`;
        // Xtream API uses 'id' for episodes usually, but fallback to stream_id/episode_id
        const streamId = ep.id || ep.stream_id || ep.episode_id;
        const ext = ep.container_extension || 'mp4';
        const cover = ep.info && (ep.info.movie_image || ep.info.cover); // basic check
        
        const card = document.createElement('div');
        card.className = 'episode-card';
        card.innerHTML = `
            <div class="episode-thumbnail">
               ${cover ? `<img src="${cover}" loading="lazy">` : ''}
               <span class="episode-number">${ep.episode_num || index + 1}</span>
            </div>
            <div class="episode-info">
               <div class="episode-title">${escapeHtml(title)}</div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            if (callbacks.onStreamClick) {
                callbacks.onStreamClick(streamId, ext, title, 'series');
            }
        });
        fragment.appendChild(card);
    });
    list.appendChild(fragment);
}

