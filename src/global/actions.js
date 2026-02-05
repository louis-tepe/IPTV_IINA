import { state } from './state.js';
import { log, logError, CACHE_TTL } from '../shared/utils.js';

const win = iina.standaloneWindow;

// Helper: Check Cache
function isCacheValid(cacheEntry) {
  if (!cacheEntry || !cacheEntry.data) return false;
  return (Date.now() - cacheEntry.timestamp) < CACHE_TTL;
}

function getStreamCacheKey(type, categoryId) {
  return `${type}:${categoryId}`;
}

// Action: Load Content (Dispatcher)
export async function handleLoad(data) {
  const { type, category } = data;
  log(`[handleLoad] type=${type}, category=${category}`);
  
  if (!category) {
    await loadCategories(type);
  } else {
    await loadStreams(type, category);
  }
}

// Load Categories
async function loadCategories(type) {
  if (!state.api) {
    win.postMessage('categories', []);
    return;
  }
  
  let action, cacheKey;
  if (type === 'live') { action = 'get_live_categories'; cacheKey = 'liveCategories'; }
  else if (type === 'vod') { action = 'get_vod_categories'; cacheKey = 'vodCategories'; }
  else if (type === 'series') { action = 'get_series_categories'; cacheKey = 'seriesCategories'; }
  else {
      win.postMessage('categories', []);
      return;
  }
  
  if (isCacheValid(state.cache[cacheKey])) {
      log(`[Cache Hit] ${type} categories`);
      win.postMessage('categories', state.cache[cacheKey].data);
      return;
  }
  
  try {
      const cats = await state.api.request(action);
      if (Array.isArray(cats)) {
          state.cache[cacheKey] = { data: cats, timestamp: Date.now() };
          win.postMessage('categories', cats);
      } else {
          throw new Error('Invalid response');
      }
  } catch (e) {
      logError(`Failed to load ${type} categories: ${e.message}`);
      win.postMessage('categories', []); // Send empty to stop loading
      win.postMessage('error', { message: `Failed to load categories: ${e.message}` });
  }
}

// Load Streams
async function loadStreams(type, catId) {
    if (!state.api) {
        win.postMessage('render', []);
        return;
    }
    
    let action;
    if (type === 'live') action = 'get_live_streams';
    else if (type === 'vod') action = 'get_vod_streams';
    else if (type === 'series') action = 'get_series';
    else {
        win.postMessage('render', []);
        return;
    }
    
    const cacheKey = getStreamCacheKey(type, catId);
    if (isCacheValid(state.cache.streams[cacheKey])) {
        log(`[Cache Hit] Streams for ${cacheKey}`);
        win.postMessage('render', state.cache.streams[cacheKey].data);
        return;
    }
    
    try {
        const streams = await state.api.request(action, { category_id: catId });
        if (Array.isArray(streams)) {
            state.cache.streams[cacheKey] = { data: streams, timestamp: Date.now() };
            win.postMessage('render', streams);
        } else {
            throw new Error('Invalid response');
        }
    } catch (e) {
        logError(`Failed to load streams: ${e.message}`);
        win.postMessage('render', []);
        win.postMessage('error', { message: e.message });
    }
}

// Load Series Info
export async function handleLoadSeriesInfo(data) {
    const { seriesId, seriesName } = data;
    if (!state.api) return;
    
    try {
        const result = await state.api.request('get_series_info', { series_id: seriesId });
        if (result && result.episodes) {
            const payload = {
                seriesId,
                name: (result.info && result.info.name) || seriesName,
                cover: (result.info && result.info.cover) || '',
                plot: (result.info && result.info.plot) || '',
                rating: (result.info && result.info.rating) || '',
                seasons: result.episodes
            };
            win.postMessage('seriesInfo', payload);
        } else {
            throw new Error('No episodes found');
        }
    } catch (e) {
        logError(`Failed to load series info: ${e.message}`);
        win.postMessage('error', { message: `Failed to load series: ${e.message}` });
    }
}

// Get EPG
export async function handleGetEpg(data) {
    const { streamId } = data;
    if (!state.api) return;
    
    try {
        const epg = await state.api.getEpg(streamId);
        win.postMessage('epgData', { streamId, data: epg });
    } catch (e) {
        win.postMessage('epgData', { streamId, error: e.message });
    }
}

// Search
export async function handleSearch(data) {
    const { query } = data;
    if (!state.api || !query || query.length < 2) return;
    
    // Clear debounce in caller usually, but here we can just execute
    // Real-world: do all 3 requests
    try {
        const results = [];
        // Live
        try {
           const live = await state.api.request('get_live_streams');
           if(Array.isArray(live)) results.push(...live.filter(s => s.name.toLowerCase().includes(query.toLowerCase())).map(s => ({...s, searchType: 'live'})));
        } catch(e) {}
        
        // VOD
        try {
           const vod = await state.api.request('get_vod_streams');
           if(Array.isArray(vod)) results.push(...vod.filter(s => s.name.toLowerCase().includes(query.toLowerCase())).map(s => ({...s, searchType: 'vod'})));
        } catch(e) {}
    
        // Series
        try {
           const series = await state.api.request('get_series');
           if(Array.isArray(series)) results.push(...series.filter(s => s.name.toLowerCase().includes(query.toLowerCase())).map(s => ({...s, searchType: 'series'})));
        } catch(e) {}
        
        win.postMessage('render', results.slice(0, 50));
    } catch(e) {
        win.postMessage('render', []);
    }
}

// Favorite
export function handleFavorite(data) {
    const { id, type, name } = data;
    if (!id) return;
    
    if (state.favorites[id]) {
        delete state.favorites[id];
    } else {
        state.favorites[id] = { id, type, name, addedAt: Date.now() };
    }
    
    // Persist to storage
    import('./storage.js').then(({ saveFavoritesToDisk }) => {
        saveFavoritesToDisk(state.favorites);
    });
    
    win.postMessage('favorites', state.favorites);
}
