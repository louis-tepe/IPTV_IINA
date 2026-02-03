/**
 * Xtream Codes API Client
 * Handles all communication with IPTV servers using the Xtream Codes protocol
 */

export class XtreamAPI {
  constructor(credentials) {
    this.server = credentials.server.replace(/\/$/, ''); // Remove trailing slash
    this.username = credentials.username;
    this.password = credentials.password;
    this.serverName = credentials.name || 'IPTV';
    
    // Cache for categories
    this.cache = {
      liveCategories: null,
      vodCategories: null,
      seriesCategories: null,
      userInfo: null
    };
  }

  /**
   * Build API URL with authentication
   */
  buildUrl(action, params = {}) {
    const url = new URL(`${this.server}/player_api.php`);
    url.searchParams.set('username', this.username);
    url.searchParams.set('password', this.password);
    url.searchParams.set('action', action);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    
    return url.toString();
  }

  /**
   * Make HTTP request to API
   */
  async request(action, params = {}) {
    const url = this.buildUrl(action, params);
    
    try {
      const response = await iina.http.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'IINA-IPTV-Plugin/1.0'
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return JSON.parse(response.body);
    } catch (error) {
      iina.console.error(`[XtreamAPI] Request failed: ${action} - ${error.message}`);
      throw error;
    }
  }

  /**
   * Authenticate and get user info
   */
  async authenticate() {
    const data = await this.request('');
    this.cache.userInfo = data;
    return data;
  }

  /**
   * Get user account info
   */
  async getUserInfo() {
    if (this.cache.userInfo) {
      return this.cache.userInfo;
    }
    return this.authenticate();
  }

  /**
   * Preload all categories for faster navigation
   */
  async preloadCategories() {
    const [live, vod, series] = await Promise.all([
      this.getLiveCategories(),
      this.getVodCategories(),
      this.getSeriesCategories()
    ]);
    
    return { live, vod, series };
  }

  // ============================================
  // LIVE TV
  // ============================================

  /**
   * Get all live TV categories
   */
  async getLiveCategories() {
    if (this.cache.liveCategories) {
      return this.cache.liveCategories;
    }
    
    const categories = await this.request('get_live_categories');
    this.cache.liveCategories = categories || [];
    return this.cache.liveCategories;
  }

  /**
   * Get live streams, optionally filtered by category
   */
  async getLiveStreams(categoryId = null) {
    const params = {};
    if (categoryId) {
      params.category_id = categoryId;
    }
    return this.request('get_live_streams', params);
  }

  /**
   * Get EPG for a live stream
   */
  async getLiveEpg(streamId) {
    return this.request('get_short_epg', { stream_id: streamId });
  }

  /**
   * Get full EPG for all channels
   */
  async getFullEpg() {
    return this.request('get_simple_data_table', { stream_id: 'all' });
  }

  // ============================================
  // VOD (Movies)
  // ============================================

  /**
   * Get all VOD categories
   */
  async getVodCategories() {
    if (this.cache.vodCategories) {
      return this.cache.vodCategories;
    }
    
    const categories = await this.request('get_vod_categories');
    this.cache.vodCategories = categories || [];
    return this.cache.vodCategories;
  }

  /**
   * Get VOD streams, optionally filtered by category
   */
  async getVodStreams(categoryId = null) {
    const params = {};
    if (categoryId) {
      params.category_id = categoryId;
    }
    return this.request('get_vod_streams', params);
  }

  /**
   * Get detailed info for a VOD item
   */
  async getVodInfo(vodId) {
    return this.request('get_vod_info', { vod_id: vodId });
  }

  // ============================================
  // SERIES
  // ============================================

  /**
   * Get all series categories
   */
  async getSeriesCategories() {
    if (this.cache.seriesCategories) {
      return this.cache.seriesCategories;
    }
    
    const categories = await this.request('get_series_categories');
    this.cache.seriesCategories = categories || [];
    return this.cache.seriesCategories;
  }

  /**
   * Get series, optionally filtered by category
   */
  async getSeries(categoryId = null) {
    const params = {};
    if (categoryId) {
      params.category_id = categoryId;
    }
    return this.request('get_series', params);
  }

  /**
   * Get detailed series info with episodes
   */
  async getSeriesInfo(seriesId) {
    return this.request('get_series_info', { series_id: seriesId });
  }

  // ============================================
  // STREAM URL GENERATION
  // ============================================

  /**
   * Generate playable stream URL
   */
  getStreamUrl(item, type) {
    const streamId = item.stream_id;
    const extension = item.container_extension || 'ts';
    
    switch (type) {
      case 'live':
        return `${this.server}/live/${this.username}/${this.password}/${streamId}.ts`;
      
      case 'vod':
        return `${this.server}/movie/${this.username}/${this.password}/${streamId}.${extension}`;
      
      case 'series':
        return `${this.server}/series/${this.username}/${this.password}/${streamId}.${extension}`;
      
      default:
        throw new Error(`Unknown stream type: ${type}`);
    }
  }

  /**
   * Get M3U playlist URL for all content
   */
  getM3uUrl() {
    return `${this.server}/get.php?username=${this.username}&password=${this.password}&type=m3u_plus&output=ts`;
  }

  /**
   * Get XMLTV EPG URL
   */
  getEpgUrl() {
    return `${this.server}/xmltv.php?username=${this.username}&password=${this.password}`;
  }

  // ============================================
  // SEARCH
  // ============================================

  /**
   * Search across all content types
   */
  async search(query, types = ['live', 'vod', 'series']) {
    const results = {
      live: [],
      vod: [],
      series: []
    };
    
    const searchLower = query.toLowerCase();
    
    const searchPromises = [];
    
    if (types.includes('live')) {
      searchPromises.push(
        this.getLiveStreams().then(streams => {
          results.live = (streams || []).filter(s => 
            s.name?.toLowerCase().includes(searchLower)
          ).slice(0, 50);
        })
      );
    }
    
    if (types.includes('vod')) {
      searchPromises.push(
        this.getVodStreams().then(streams => {
          results.vod = (streams || []).filter(s => 
            s.name?.toLowerCase().includes(searchLower)
          ).slice(0, 50);
        })
      );
    }
    
    if (types.includes('series')) {
      searchPromises.push(
        this.getSeries().then(series => {
          results.series = (series || []).filter(s => 
            s.name?.toLowerCase().includes(searchLower)
          ).slice(0, 50);
        })
      );
    }
    
    await Promise.all(searchPromises);
    
    return results;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache = {
      liveCategories: null,
      vodCategories: null,
      seriesCategories: null,
      userInfo: null
    };
  }
}
