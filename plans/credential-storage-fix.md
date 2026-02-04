# Credential Storage Fix - Technical Specification

## Problem Statement

The IPTV plugin does not persist user account credentials between IINA sessions. Users must re-enter their server URL, username, and password every time they close and reopen IINA.

## Root Cause Analysis

After analyzing the codebase, the following issues were identified:

### 1. Generic Storage Keys
The current implementation uses generic preference keys without a plugin-specific prefix:
- `'server'`
- `'username'`
- `'password'`

These keys could conflict with other plugins or IINA's own preferences.

### 2. Credentials Cleared on Disconnect
The [`handleDisconnect()`](global.js:1014-1037) function clears credentials from storage when the user disconnects. This is problematic because:
- Users may want to disconnect temporarily without losing their credentials
- An accidental disconnect removes all saved login information

### 3. No Validation
There's no validation to ensure credentials were actually saved successfully, and no error handling for storage failures.

### 4. No User Choice
There's no option for users to choose whether they want to save their credentials or not.

## Proposed Solution

### 1. Prefixed Storage Keys
Use plugin-specific prefixed keys to avoid conflicts:
- `'iptv_server'`
- `'iptv_username'`
- `'iptv_password'`
- `'iptv_remember_me'`

### 2. "Remember Me" Feature
Add a "Remember Me" checkbox to the connection form:
- When checked: credentials are saved and auto-connect on next launch
- When unchecked: credentials are not saved, manual entry required each time

### 3. Separate Disconnect from Logout
- **Disconnect**: Keeps saved credentials, just disconnects from the server
- **Logout** (new): Clears credentials and disconnects

### 4. Basic Password Encryption
Implement base64 encoding for passwords to provide basic obfuscation (note: this is not true security, just prevents casual viewing).

### 5. Storage Validation
Add validation to verify credentials are saved correctly and handle storage errors gracefully.

## Implementation Plan

### Phase 1: Update Storage Functions ([`global.js`](global.js:470-486))

```javascript
// New storage keys with prefix
const STORAGE_KEYS = {
  SERVER: 'iptv_server',
  USERNAME: 'iptv_username',
  PASSWORD: 'iptv_password',
  REMEMBER_ME: 'iptv_remember_me'
};

// Base64 encode/decode helpers
function encodePassword(password) {
  if (!password) return '';
  try {
    return btoa(password);
  } catch (e) {
    return password;
  }
}

function decodePassword(encoded) {
  if (!encoded) return '';
  try {
    return atob(encoded);
  } catch (e) {
    return encoded;
  }
}

// Updated loadCredentials with validation
function loadCredentials() {
  try {
    const server = prefs.get(STORAGE_KEYS.SERVER) || '';
    const username = prefs.get(STORAGE_KEYS.USERNAME) || '';
    const encodedPassword = prefs.get(STORAGE_KEYS.PASSWORD) || '';
    const rememberMe = prefs.get(STORAGE_KEYS.REMEMBER_ME) === 'true';
    
    const credentials = {
      server: server,
      username: username,
      password: decodePassword(encodedPassword),
      rememberMe: rememberMe
    };
    
    log('[Storage] Credentials loaded successfully');
    return credentials;
  } catch (e) {
    logError('[Storage] Failed to load credentials: ' + e.message);
    return { server: '', username: '', password: '', rememberMe: false };
  }
}

// Updated saveCredentials with validation
function saveCredentials(c, shouldRemember = true) {
  try {
    if (shouldRemember) {
      prefs.set(STORAGE_KEYS.SERVER, c.server || '');
      prefs.set(STORAGE_KEYS.USERNAME, c.username || '');
      prefs.set(STORAGE_KEYS.PASSWORD, encodePassword(c.password || ''));
      prefs.set(STORAGE_KEYS.REMEMBER_ME, 'true');
      log('[Storage] ✓ Credentials saved (remember me enabled)');
    } else {
      // Clear credentials if remember me is not checked
      prefs.set(STORAGE_KEYS.SERVER, '');
      prefs.set(STORAGE_KEYS.USERNAME, '');
      prefs.set(STORAGE_KEYS.PASSWORD, '');
      prefs.set(STORAGE_KEYS.REMEMBER_ME, 'false');
      log('[Storage] ✓ Credentials cleared (remember me disabled)');
    }
    return true;
  } catch (e) {
    logError('[Storage] Failed to save credentials: ' + e.message);
    return false;
  }
}

// New function: clearCredentials (for logout)
function clearCredentials() {
  try {
    prefs.set(STORAGE_KEYS.SERVER, '');
    prefs.set(STORAGE_KEYS.USERNAME, '');
    prefs.set(STORAGE_KEYS.PASSWORD, '');
    prefs.set(STORAGE_KEYS.REMEMBER_ME, 'false');
    log('[Storage] ✓ Credentials cleared');
    return true;
  } catch (e) {
    logError('[Storage] Failed to clear credentials: ' + e.message);
    return false;
  }
}
```

### Phase 2: Update Connection Form ([`connection.html`](connection.html))

Add a "Remember Me" checkbox to the form:

```html
<div class="form-group">
  <label class="remember-me-label">
    <input type="checkbox" id="rememberMe" checked>
    <span>Remember me on this computer</span>
  </label>
</div>
```

Add corresponding CSS:

```css
.remember-me-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  margin-top: var(--spacing-sm);
}

.remember-me-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}
```

Update JavaScript to handle the checkbox:

```javascript
var rememberMeCheckbox = document.getElementById('rememberMe');

// Handle form submission
form.addEventListener('submit', function(e) {
  e.preventDefault();
  
  var server = serverInput.value.trim();
  var username = usernameInput.value.trim();
  var password = passwordInput.value.trim();
  var rememberMe = rememberMeCheckbox.checked;

  if (!server || !username || !password) {
    errorDiv.textContent = 'Please fill in all fields.';
    errorDiv.hidden = false;
    return;
  }

  // Add http:// if missing
  if (server.indexOf('http') !== 0) {
    server = 'http://' + server;
    serverInput.value = server;
  }

  // Hide error, show loading
  errorDiv.hidden = true;
  connectBtn.classList.add('loading');
  connectBtn.disabled = true;

  // Send connect message with rememberMe flag
  if (window.iina && iina.postMessage) {
    iina.postMessage('connect', {
      server: server,
      username: username,
      password: password,
      rememberMe: rememberMe
    });
  }
});
```

### Phase 3: Update handleConnect ([`global.js`](global.js:966-1009))

Modify the `handleConnect` function to accept and use the `rememberMe` flag:

```javascript
async function handleConnect(data) {
  log('handleConnect started');

  var server = (data.server || '').trim();
  if (server.indexOf('http') !== 0) {
    server = 'http://' + server;
  }

  var creds = {
    server: server,
    username: (data.username || '').trim(),
    password: (data.password || '').trim()
  };

  if (!creds.server || !creds.username || !creds.password) {
    win.postMessage('error', 'Please fill in all fields');
    return;
  }

  log('Creating API client for: ' + server);
  state.api = new XtreamAPI(creds);

  try {
    log('Testing connection...');
    var result = await state.api.request('get_live_categories');

    if (!Array.isArray(result)) {
      throw new Error('Invalid response from server');
    }

    log('Connection successful! Got ' + result.length + ' categories');
    state.isConnected = true;
    state.credentials = creds;
    
    // Save credentials only if rememberMe is true
    var shouldRemember = data.rememberMe !== false; // default to true
    saveCredentials(creds, shouldRemember);
    clearCache(); // Fresh cache on new connection

    win.postMessage('success');
    showBrowserPage();
  } catch (err) {
    logError('Connection failed: ' + err.message);
    state.api = null;
    win.postMessage('error', 'Connection failed: ' + err.message);
  }
}
```

### Phase 4: Update handleDisconnect ([`global.js`](global.js:1014-1037))

Modify to NOT clear credentials by default (just disconnect):

```javascript
function handleDisconnect(clearCreds = false) {
  log('>>> handleDisconnect CALLED');
  log('  Disconnecting from server: ' + (state.credentials ? state.credentials.server : 'unknown'));
  log('  Clear credentials: ' + clearCreds);
  
  state.isConnected = false;
  state.api = null;
  state.credentials = null;
  
  // Only clear credentials if explicitly requested (logout)
  if (clearCreds) {
    clearCredentials();
  }
  
  clearCache();
  
  win.loadFile('connection.html');
  setTimeout(function() {
    var creds = loadCredentials();
    win.postMessage('init', creds);
  }, 300);
  
  log('✓ Disconnected and returned to connection screen');
  log('<<< handleDisconnect END');
}
```

### Phase 5: Update showWindow ([`global.js`](global.js:672-701))

Update to handle the `rememberMe` flag:

```javascript
function showWindow() {
  log('=== showWindow called ===');
  
  loadFavorites();
  loadHistory();
  loadCache();

  win.loadFile('connection.html');
  win.setProperty({
    title: 'IPTV Player v' + PLUGIN_VERSION,
    resizable: true,
    fullSizeContentView: false,
    hideTitleBar: false
  });
  win.setFrame(420, 650);

  setupMessageHandlers();
  win.open();

  setTimeout(function() {
    var creds = loadCredentials();
    win.postMessage('init', creds);
    
    // Auto-reconnect only if rememberMe was enabled and credentials exist
    if (creds.rememberMe && creds.server && creds.username && creds.password) {
      log('Valid credentials found with rememberMe=true, attempting auto-connect...');
      win.postMessage('autoConnect', creds);
    } else if (!creds.rememberMe) {
      log('Remember me is disabled, skipping auto-connect');
    } else {
      log('No saved credentials found, manual entry required');
    }
  }, 500);
}
```

## Migration Strategy

### Backward Compatibility
To maintain backward compatibility with existing saved credentials:

```javascript
function loadCredentials() {
  try {
    // Try new prefixed keys first
    let server = prefs.get(STORAGE_KEYS.SERVER);
    let username = prefs.get(STORAGE_KEYS.USERNAME);
    let encodedPassword = prefs.get(STORAGE_KEYS.PASSWORD);
    let rememberMe = prefs.get(STORAGE_KEYS.REMEMBER_ME);
    
    // If new keys don't exist, try old keys for migration
    if (!server && !username) {
      server = prefs.get('server');
      username = prefs.get('username');
      encodedPassword = prefs.get('password');
      
      // Migrate to new keys if old keys exist
      if (server || username) {
        log('[Storage] Migrating credentials to new storage format');
        prefs.set(STORAGE_KEYS.SERVER, server || '');
        prefs.set(STORAGE_KEYS.USERNAME, username || '');
        prefs.set(STORAGE_KEYS.PASSWORD, encodedPassword || '');
        prefs.set(STORAGE_KEYS.REMEMBER_ME, 'true');
        
        // Clear old keys
        prefs.set('server', '');
        prefs.set('username', '');
        prefs.set('password', '');
      }
    }
    
    return {
      server: server || '',
      username: username || '',
      password: decodePassword(encodedPassword || ''),
      rememberMe: rememberMe === 'true'
    };
  } catch (e) {
    logError('[Storage] Failed to load credentials: ' + e.message);
    return { server: '', username: '', password: '', rememberMe: false };
  }
}
```

## Testing Checklist

1. **Fresh Install**
   - [ ] Install plugin for the first time
   - [ ] Verify no credentials are loaded
   - [ ] Connect with "Remember Me" checked
   - [ ] Close and reopen IINA
   - [ ] Verify auto-connect works

2. **Remember Me Disabled**
   - [ ] Connect with "Remember Me" unchecked
   - [ ] Close and reopen IINA
   - [ ] Verify manual entry is required

3. **Disconnect Behavior**
   - [ ] Connect with saved credentials
   - [ ] Click Disconnect
   - [ ] Verify credentials are still saved
   - [ ] Verify auto-connect still works

4. **Logout Behavior**
   - [ ] Connect with saved credentials
   - [ ] Click Logout (new feature)
   - [ ] Verify credentials are cleared
   - [ ] Verify manual entry is required

5. **Migration**
   - [ ] Install old version and save credentials
   - [ ] Upgrade to new version
   - [ ] Verify credentials are migrated and work

## UI/UX Considerations

1. **Visual Feedback**: Show a message when credentials are saved or loaded
2. **Security Warning**: Add a tooltip explaining that "Remember Me" stores credentials locally
3. **Clear Indication**: Make it clear when auto-connect is happening vs manual entry

## Security Notes

1. **Base64 encoding** is NOT encryption - it only prevents casual viewing
2. Credentials are stored in IINA's preferences which are accessible to other plugins with "preferences" permission
3. For production use, consider using macOS Keychain (would require additional permissions)

## Files to Modify

1. [`global.js`](global.js) - Storage functions, handleConnect, handleDisconnect, showWindow
2. [`connection.html`](connection.html) - Add Remember Me checkbox and styling
3. [`browser.js`](browser.js) - Add logout button option
4. [`Info.json`](Info.json) - Update version number

## Estimated Effort

This is a medium complexity task requiring:
- Code changes across 3-4 files
- New UI elements
- Migration logic for backward compatibility
- Comprehensive testing

## Future Enhancements

1. **Keychain Integration**: Use macOS Keychain for secure credential storage
2. **Multiple Accounts**: Support saving multiple IPTV accounts
3. **Credential Expiry**: Option to expire saved credentials after a period
4. **Biometric Auth**: Touch ID / Face ID integration for accessing saved credentials
