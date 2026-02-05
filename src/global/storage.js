import { log, logError, base64Encode, base64Decode } from '../shared/utils.js';

const CREDENTIALS_FILE = 'iptv_credentials.json';

function encodePassword(password) {
  if (!password) return '';
  return base64Encode(password);
}

function decodePassword(encoded) {
  if (!encoded) return '';
  return base64Decode(encoded);
}

function getCredentialsFilePath() {
  const pluginDir = '/Users/tepe/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin';
  return `${pluginDir}/${CREDENTIALS_FILE}`;
}

export async function writeCredentialsToFile(credentials) {
  try {
    if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') {
      log('[Storage] iina.utils.exec not available, skipping file write');
      return false;
    }
    
    const dataToSave = {
      server: credentials.server || '',
      username: credentials.username || '',
      password: encodePassword(credentials.password || ''),
      rememberMe: credentials.rememberMe || false,
      savedAt: new Date().toISOString(),
      version: '5.5.0'
    };
    
    const jsonData = JSON.stringify(dataToSave);
    const filePath = getCredentialsFilePath();
    
    // Commands
    const mkdirCmd = `/bin/mkdir -p "${filePath.substring(0, filePath.lastIndexOf('/'))}"`;
    // Escape single quotes for shell safety
    const safeJson = jsonData.replace(/'/g, "'\"'\"'");
    const writeCmd = `/usr/bin/printf "%s" '${safeJson}' > "${filePath}"`;
    
    await iina.utils.exec('/bin/sh', ['-c', mkdirCmd], null, () => {}, () => {});
    const result = await iina.utils.exec('/bin/sh', ['-c', writeCmd], null, () => {}, () => {});
    
    if (result && result.status === 0) {
      log(`[Storage] ✓ Credentials written to file: ${filePath}`);
      return true;
    } else {
      logError(`[Storage] Failed to write credentials file, status: ${result ? result.status : 'unknown'}`);
      return false;
    }
  } catch (e) {
    logError(`[Storage] Failed to write credentials to file: ${e.message}`);
    return false;
  }
}

export async function readCredentialsFromFile() {
  try {
    if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') return null;
    
    const filePath = getCredentialsFilePath();
    const stdoutChunks = [];
    
    const result = await iina.utils.exec('/bin/cat', [filePath], null, 
      (chunk) => stdoutChunks.push(chunk),
      () => {}
    );

    if (result && result.status === 0 && stdoutChunks.length > 0) {
      const jsonData = stdoutChunks.join('');
      if (!jsonData || jsonData.trim() === '') return null;
      
      try {
        const data = JSON.parse(jsonData);
        log('[Storage] ✓ Credentials loaded from file');
        return {
          server: data.server || '',
          username: data.username || '',
          password: decodePassword(data.password || ''),
          rememberMe: data.rememberMe === true
        };
      } catch (parseErr) {
        logError(`[Storage] Failed to parse credentials file: ${parseErr.message}`);
        return null;
      }
    }
    return null;
  } catch (e) {
    log('[Storage] No credentials file found or read error');
    return null;
  }
}

export async function deleteCredentialsFile() {
  try {
    const filePath = getCredentialsFilePath();
    await iina.utils.exec('/bin/rm', ['-f', filePath], null, () => {}, () => {});
    log('[Storage] ✓ Credentials file deleted');
    return true;
  } catch (e) {
    logError(`[Storage] Failed to delete credentials file: ${e.message}`);
    return false;
  }
}

// --- Favorites Storage ---

const FAVORITES_FILE = 'iptv_favorites.json';

function getFavoritesFilePath() {
  const pluginDir = '/Users/tepe/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin';
  return `${pluginDir}/${FAVORITES_FILE}`;
}

export async function saveFavoritesToDisk(favorites) {
  try {
    if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') {
      return false;
    }

    const jsonData = JSON.stringify(favorites);
    const filePath = getFavoritesFilePath();
    
    // Escape single quotes for shell safety
    const safeJson = jsonData.replace(/'/g, "'\"'\"'");
    const writeCmd = `/usr/bin/printf "%s" '${safeJson}' > "${filePath}"`;
    
    // We assume mkdir was handled by credentials write, but safe to repeat or just rely on parent dir existing
    // Let's just write
    const result = await iina.utils.exec('/bin/sh', ['-c', writeCmd], null, () => {}, () => {});
    
    if (result && result.status === 0) {
      log(`[Storage] Favorites saved to disk (${Object.keys(favorites).length} items)`);
      return true;
    }
    return false;
  } catch (e) {
    logError(`[Storage] Failed to save favorites: ${e.message}`);
    return false;
  }
}

export async function loadFavoritesFromDisk() {
  try {
    if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') return {};
    
    const filePath = getFavoritesFilePath();
    const stdoutChunks = [];
    
    const result = await iina.utils.exec('/bin/cat', [filePath], null, 
      (chunk) => stdoutChunks.push(chunk),
      () => {}
    );

    if (result && result.status === 0 && stdoutChunks.length > 0) {
      const jsonData = stdoutChunks.join('');
      if (!jsonData || jsonData.trim() === '') return {};
      
      const favs = JSON.parse(jsonData);
      log(`[Storage] Loaded ${Object.keys(favs).length} favorites from disk`);
      return favs;
    }
    return {};
  } catch (e) {
    log('[Storage] No favorites file found or read error');
    return {};
  }
}
