/**
 * Sidebar Controller
 * Manages the sidebar webview and communication with the UI
 */

export class SidebarController {
  constructor(options) {
    this.api = options.api;
    this.favorites = options.favorites;
    this.history = options.history;
    this.onPlay = options.onPlay;
    this.onFavorite = options.onFavorite;
    this.onConnect = options.onConnect;
    
    this.sidebar = null;
    this.isVisible = false;
    
    this.init();
  }

  /**
   * Initialize the sidebar
   */
  init() {
    // Create sidebar with HTML content
    this.sidebar = iina.sidebar.create({
      tabId: 'iptv-browser',
      html: 'src/ui/sidebar.html',
      width: 320,
      onLoad: () => this.onSidebarLoad(),
      onMessage: (data) => this.onSidebarMessage(data)
    });
    
    iina.console.log('[Sidebar] Initialized');
  }

  /**
   * Called when sidebar HTML is loaded
   */
  onSidebarLoad() {
    // Inject API and callbacks into sidebar
    this.sidebar.evaluate(`
      window.iptv = {
        isConnected: ${this.api ? 'true' : 'false'},
        favorites: null,
        history: null
      };
    `);
    
    // If already connected, initialize with API
    if (this.api) {
      this.setConnected(true, this.api);
    }
    
    iina.console.log('[Sidebar] HTML loaded');
  }

  /**
   * Handle messages from sidebar
   */
  async onSidebarMessage(data) {
    const { action, payload } = data;
    
    switch (action) {
      case 'connect':
        return await this.handleConnectRequest(payload);
      
      case 'play':
        return this.handlePlayRequest(payload);
      
      case 'favorite':
        return this.handleFavoriteRequest(payload);
      
      case 'getFavorites':
        return this.getFavoritesList();
      
      case 'getHistory':
        return this.getHistoryList();
      
      default:
        iina.console.warn(`[Sidebar] Unknown action: ${action}`);
    }
  }

  /**
   * Handle connection request from UI
   */
  async handleConnectRequest(credentials) {
    if (this.onConnect) {
      const success = await this.onConnect(credentials);
      return { success };
    }
    return { success: false };
  }

  /**
   * Handle play request from UI
   */
  handlePlayRequest({ item, type }) {
    if (this.onPlay) {
      this.onPlay(item, type);
    }
  }

  /**
   * Handle favorite request from UI
   */
  handleFavoriteRequest({ item, type }) {
    if (this.onFavorite) {
      this.onFavorite(item, type);
    }
  }

  /**
   * Get favorites list for UI
   */
  getFavoritesList() {
    if (this.favorites) {
      return this.favorites.getAll();
    }
    return [];
  }

  /**
   * Get history list for UI
   */
  getHistoryList() {
    if (this.history) {
      return this.history.getRecent(50);
    }
    return [];
  }

  /**
   * Set connected state in UI
   */
  setConnected(connected, api = null) {
    if (api) {
      this.api = api;
    }
    
    // Update sidebar state
    this.sidebar.evaluate(`
      window.iptvApi = {
        serverName: "${this.api?.serverName || ''}",
        cache: ${JSON.stringify(this.api?.cache || {})},
        
        async getLiveCategories() {
          return window.sidebarBridge.call('getLiveCategories');
        },
        async getVodCategories() {
          return window.sidebarBridge.call('getVodCategories');
        },
        async getSeriesCategories() {
          return window.sidebarBridge.call('getSeriesCategories');
        },
        async getLiveStreams(categoryId) {
          return window.sidebarBridge.call('getLiveStreams', { categoryId });
        },
        async getVodStreams(categoryId) {
          return window.sidebarBridge.call('getVodStreams', { categoryId });
        },
        async getSeries(categoryId) {
          return window.sidebarBridge.call('getSeries', { categoryId });
        },
        async getSeriesInfo(seriesId) {
          return window.sidebarBridge.call('getSeriesInfo', { seriesId });
        },
        async search(query) {
          return window.sidebarBridge.call('search', { query });
        },
        clearCache() {
          window.sidebarBridge.call('clearCache');
        }
      };
      
      window.iptv = {
        isConnected: true,
        favorites: {
          has: (key) => window.sidebarBridge.call('hasFavorite', { key }),
          getAll: () => window.sidebarBridge.call('getFavorites')
        },
        history: {
          getRecent: (count) => window.sidebarBridge.call('getHistory', { count })
        },
        onPlay: (item, type) => window.sidebarBridge.send('play', { item, type }),
        onFavorite: (item, type) => window.sidebarBridge.send('favorite', { item, type }),
        onConnect: (credentials) => window.sidebarBridge.call('connect', credentials)
      };
      
      if (window.sidebarUI) {
        window.sidebarUI.setConnected(true);
      }
    `);
    
    // Setup bridge handlers
    this.setupBridge();
  }

  /**
   * Setup message bridge for API calls
   */
  setupBridge() {
    this.sidebar.onMessage = async (data) => {
      const { id, method, params } = data;
      
      let result = null;
      let error = null;
      
      try {
        switch (method) {
          case 'getLiveCategories':
            result = await this.api.getLiveCategories();
            break;
          case 'getVodCategories':
            result = await this.api.getVodCategories();
            break;
          case 'getSeriesCategories':
            result = await this.api.getSeriesCategories();
            break;
          case 'getLiveStreams':
            result = await this.api.getLiveStreams(params.categoryId);
            break;
          case 'getVodStreams':
            result = await this.api.getVodStreams(params.categoryId);
            break;
          case 'getSeries':
            result = await this.api.getSeries(params.categoryId);
            break;
          case 'getSeriesInfo':
            result = await this.api.getSeriesInfo(params.seriesId);
            break;
          case 'search':
            result = await this.api.search(params.query);
            break;
          case 'clearCache':
            this.api.clearCache();
            result = true;
            break;
          case 'hasFavorite':
            result = this.favorites?.has(params.key) || false;
            break;
          case 'getFavorites':
            result = this.favorites?.getAll() || [];
            break;
          case 'getHistory':
            result = this.history?.getRecent(params.count || 50) || [];
            break;
          case 'connect':
            const success = await this.onConnect(params);
            result = { success };
            break;
          case 'play':
            this.onPlay(params.item, params.type);
            result = true;
            break;
          case 'favorite':
            this.onFavorite(params.item, params.type);
            result = true;
            break;
          default:
            error = `Unknown method: ${method}`;
        }
      } catch (e) {
        error = e.message;
      }
      
      // Send response back
      if (id) {
        this.sidebar.evaluate(`
          window.sidebarBridge.resolve(${id}, ${JSON.stringify(result)}, ${error ? `"${error}"` : 'null'});
        `);
      }
    };
    
    // Inject bridge script
    this.sidebar.evaluate(`
      window.sidebarBridge = {
        _id: 0,
        _pending: new Map(),
        
        call(method, params = {}) {
          return new Promise((resolve, reject) => {
            const id = ++this._id;
            this._pending.set(id, { resolve, reject });
            window.webkit.messageHandlers.iina.postMessage({
              id,
              method,
              params
            });
          });
        },
        
        send(method, params = {}) {
          window.webkit.messageHandlers.iina.postMessage({
            method,
            params
          });
        },
        
        resolve(id, result, error) {
          const pending = this._pending.get(id);
          if (pending) {
            this._pending.delete(id);
            if (error) {
              pending.reject(new Error(error));
            } else {
              pending.resolve(result);
            }
          }
        }
      };
    `);
  }

  /**
   * Show the sidebar
   */
  show() {
    this.sidebar.show();
    this.isVisible = true;
  }

  /**
   * Hide the sidebar
   */
  hide() {
    this.sidebar.hide();
    this.isVisible = false;
  }

  /**
   * Toggle sidebar visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Show favorites tab
   */
  showFavorites() {
    this.show();
    this.sidebar.evaluate(`
      if (window.sidebarUI) {
        window.sidebarUI.showFavorites();
      }
    `);
  }

  /**
   * Show history tab
   */
  showHistory() {
    this.show();
    this.sidebar.evaluate(`
      if (window.sidebarUI) {
        window.sidebarUI.showHistory();
      }
    `);
  }

  /**
   * Refresh current view
   */
  refresh() {
    this.sidebar.evaluate(`
      if (window.sidebarUI) {
        window.sidebarUI.refresh();
      }
    `);
  }

  /**
   * Refresh favorites in UI
   */
  refreshFavorites() {
    this.sidebar.evaluate(`
      if (window.sidebarUI && document.querySelector('.tab[data-tab="favorites"]').classList.contains('active')) {
        window.sidebarUI.showFavorites();
      }
    `);
  }
}
