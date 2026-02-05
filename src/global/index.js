import { log, logError } from '../shared/utils.js';
import { XtreamAPI } from './api.js';
import { readCredentialsFromFile, writeCredentialsToFile, deleteCredentialsFile, loadFavoritesFromDisk } from './storage.js';
import { state } from './state.js';
import { handleLoad, handleLoadSeriesInfo, handleGetEpg, handleSearch, handleFavorite } from './actions.js';

// ============================================
// IINA ALIASES
// ============================================
const win = iina.standaloneWindow;
const prefs = iina.preferences;
const menu = iina.menu;

function showWindow() {
    if (win) {
        win.loadFile('dist/browser.html');
        win.open();
    }
}

try {
   if (menu && menu.addItem && menu.item) {
       menu.addItem(menu.item('Open IPTV', showWindow));
   }
} catch (e) { logError('Menu register failed: ' + e.message); }

log('=== Plugin v5.5.0-MODULAR starting ===');

// ============================================
// MESSAGE HANDLING
// ============================================

if (win) {
  win.onMessage = async (action, data) => {
    log(`Message received: ${action}`);
    
    switch (action) {
      case 'connect':
        await handleConnect(data);
        break;
      case 'play':
        handlePlay(data);
        break;
      case 'load':
        await handleLoad(data);
        break;
      case 'loadSeriesInfo':
        await handleLoadSeriesInfo(data);
        break;
      case 'getEpg':
        await handleGetEpg(data);
        break;
      case 'search':
        await handleSearch(data);
        break;
      case 'favorite':
        handleFavorite(data);
        break;
      default:
        logError(`Unknown action: ${action}`);
    }
  };
}

async function handleConnect(creds) {
  log('Connecting...');
  state.credentials = creds;
  state.api = new XtreamAPI(creds);

  try {
    // Basic auth check using live categories as lighter weight ping
    await state.api.request('get_live_categories');
    
    state.isConnected = true;
    if (creds.rememberMe) {
      await writeCredentialsToFile(creds);
    } else {
      await deleteCredentialsFile();
    }
    
    win.postMessage('connected', { success: true });
    log('Connected successfully!');
    
  } catch (e) {
    logError('Connection failed: ' + e.message);
    win.postMessage('error', { message: 'Connection failed: ' + e.message });
  }
}

function handlePlay(data) {
  const { id, type, ext, name, resumePosition } = data;
  if (!state.api) return;

  const url = state.api.getStreamUrl(id, type, ext);
  
  // Pass to main.js via preferences
  const playRequest = {
    url,
    name,
    type,
    streamId: id,
    timestamp: Date.now(),
    resumePosition
  };
  
  prefs.set('iptv_play_request', JSON.stringify(playRequest));
  log(`Play request sent to main.js for: ${name}`);
}

// ============================================
// INIT
// ============================================

(async () => {
    // Load favorites
    try {
        const favs = await loadFavoritesFromDisk();
        state.favorites = favs || {};
    } catch (e) {
        logError('Failed to load favorites: ' + e.message);
    }

    // Try auto-login
    const saved = await readCredentialsFromFile();
    if (saved) {
        log('Auto-connecting with saved credentials...');
        handleConnect(saved);
    }
})();
