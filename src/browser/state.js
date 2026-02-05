export const state = {
  isConnected: false,
  currentTab: 'live',
  currentCategory: null,
  currentCategoryName: '',
  currentSeriesId: null,
  items: [],
  favorites: {},
  currentRequestId: 0,
  isLoading: false,
  previousView: null,
  currentRequestTimeout: null,
  debugMsgCount: 0,
  debugMinimized: false
};

export const elements = {};

export function cacheElements() {
  elements.tabs = document.querySelectorAll('.tab');
  elements.list = document.getElementById('list');
  elements.loading = document.getElementById('loading');
  elements.empty = document.getElementById('empty');
  elements.emptyMessage = document.getElementById('empty-message');
  elements.breadcrumb = document.getElementById('breadcrumb');
  elements.breadcrumbTitle = document.getElementById('breadcrumb-title');
  elements.backBtn = document.getElementById('back-btn');
  elements.searchInput = document.getElementById('search-input');
  elements.searchClear = document.getElementById('search-clear');
  elements.refreshBtn = document.getElementById('refresh-btn');
  elements.disconnectBtn = document.getElementById('disconnect-btn');
  elements.serverName = document.getElementById('server-name');
  elements.itemCount = document.getElementById('item-count');
  elements.debugPanel = document.getElementById('debug-panel');
  elements.debugLogs = document.getElementById('debug-logs');
  elements.debugClear = document.getElementById('debug-clear');
  elements.debugToggle = document.getElementById('debug-toggle');
  elements.debugMsgCount = document.getElementById('debug-msg-count');
  elements.debugLastMsg = document.getElementById('debug-last-msg');
  elements.connectionStatus = document.getElementById('connection-status');
  elements.epgModal = document.getElementById('epg-modal');
  elements.epgContent = document.getElementById('epg-content');
}
