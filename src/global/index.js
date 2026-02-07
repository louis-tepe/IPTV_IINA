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

log('=== Plugin v5.5.0-MODULAR starting ===');

// ============================================
// WINDOW MANAGEMENT - Following ytdl plugin pattern
// ============================================

function showWindow() {
    log('showWindow() called');
    if (!win) {
        logError('standaloneWindow is not available');
        return;
    }
    
    // Step 1: Load the HTML file
    log('Loading browser.html...');
    win.loadFile('dist/browser.html');
    
    // Step 2: Set window properties (optional)
    try {
        win.setProperty({
            title: 'IPTV Player',
            resizable: true,
            fullSizeContentView: false,
            hideTitleBar: false
        });
        win.setFrame(900, 600);
    } catch (e) {
        log('setProperty/setFrame not available: ' + e.message);
    }
    
    // Step 3: Set up message handlers AFTER loadFile, BEFORE open
    log('Setting up message handlers...');
    setupMessageHandlers();
    
    // Step 4: Open the window
    log('Opening window...');
    win.open();
    log('Window opened successfully');
}

// ============================================
// MESSAGE HANDLERS - Set up when window opens
// ============================================

function setupMessageHandlers() {
    log('setupMessageHandlers() called');
    
    win.onMessage('ready', (data) => {
        log('>>> Message received: ready');
        if (state.isConnected) {
            log('Already connected, sending connected message');
            win.postMessage('connected', { success: true });
        } else {
            log('Not connected yet, frontend will wait');
        }
    });
    
    win.onMessage('connect', async (data) => {
        log('>>> Message received: connect');
        await handleConnect(data);
    });
    
    win.onMessage('play', (data) => {
        log('>>> Message received: play');
        handlePlay(data);
    });
    
    win.onMessage('load', async (data) => {
        log('>>> Message received: load');
        log('  type: ' + (data ? data.type : 'undefined'));
        log('  category: ' + (data ? data.category : 'undefined'));
        await handleLoad(data);
    });
    
    win.onMessage('loadSeriesInfo', async (data) => {
        log('>>> Message received: loadSeriesInfo');
        await handleLoadSeriesInfo(data);
    });
    
    win.onMessage('getEpg', async (data) => {
        log('>>> Message received: getEpg');
        await handleGetEpg(data);
    });
    
    win.onMessage('search', async (data) => {
        log('>>> Message received: search');
        await handleSearch(data);
    });
    
    win.onMessage('favorite', (data) => {
        log('>>> Message received: favorite');
        handleFavorite(data);
    });
    
    // Browser debug log forwarding
    win.onMessage('browserLog', (data) => {
        if (data && data.msg) {
            log(`[Browser] ${data.msg}`);
        }
    });
    
    log('All message handlers registered');
}

// ============================================
// CONNECTION HANDLER
// ============================================

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

// ============================================
// PLAY HANDLER
// ============================================

function handlePlay(data) {
    const { id, type, ext, name, resumePosition } = data;
    if (!state.api) return;

    const url = state.api.getStreamUrl(id, type, ext);
    log(`Generated stream URL: ${url}`);
    
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
// MENU REGISTRATION
// ============================================

try {
    if (menu && menu.addItem && menu.item) {
        menu.addItem(menu.item('Open IPTV', showWindow));
        log('Menu item "Open IPTV" registered');
    }
} catch (e) { 
    logError('Menu register failed: ' + e.message); 
}

// ============================================
// INIT - Auto-connect if credentials saved
// ============================================

(async () => {
    log('Init: Loading favorites...');
    try {
        const favs = await loadFavoritesFromDisk();
        state.favorites = favs || {};
        log('Init: Favorites loaded');
    } catch (e) {
        logError('Failed to load favorites: ' + e.message);
    }

    log('Init: Checking for saved credentials...');
    const saved = await readCredentialsFromFile();
    if (saved) {
        log('Init: Auto-connecting with saved credentials...');
        state.credentials = saved;
        state.api = new XtreamAPI(saved);
        
        try {
            await state.api.request('get_live_categories');
            state.isConnected = true;
            log('Init: Auto-connect successful, isConnected = true');
        } catch (e) {
            logError('Init: Auto-connect failed: ' + e.message);
        }
    } else {
        log('Init: No saved credentials found');
    }
    
    log('Init complete');
})();
