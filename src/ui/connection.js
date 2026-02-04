/**
 * IINA IPTV Plugin - Connection UI Controller
 * v8.0.0
 */

'use strict';

(function() {
  var form = document.getElementById('connection-form');
  var serverInput = document.getElementById('server');
  var usernameInput = document.getElementById('username');
  var passwordInput = document.getElementById('password');
  var connectBtn = document.getElementById('connectBtn');
  var errorDiv = document.getElementById('error');

  // Store translations received from backend
  var translations = null;

  // Simple translation function using backend-provided translations
  function t(key, params) {
    if (!translations) {
      // Fallback to key if translations not loaded yet
      return key;
    }
    
    var text = translations[key] || key;
    
    if (params) {
      // Replace {param} placeholders
      Object.keys(params).forEach(function(param) {
        var regex = new RegExp('\\{' + param + '\\}', 'g');
        text = text.replace(regex, String(params[param]));
      });
    }
    
    return text;
  }

  // Apply translations to all elements with data-i18n attributes
  function applyTranslations() {
    if (!translations) return;
    
    // Apply to elements with data-i18n attribute (text content)
    var elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key);
      }
    });
    
    // Apply to elements with data-i18n-placeholder attribute (placeholder)
    var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(function(el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.setAttribute('placeholder', t(key));
      }
    });
  }

  if (window.iina && iina.onMessage) {
    // Listen for 'init' message (filtered by name)
    iina.onMessage('init', function(data) {
      console.log('[Connection] Init received:', data);
      if (data) {
        if (data.server) serverInput.value = data.server;
        if (data.username) usernameInput.value = data.username;
        if (data.password) passwordInput.value = data.password;
        if (data.translations) {
          translations = data.translations;
          applyTranslations();
        }
      }
    });

    // Listen for 'error' message
    iina.onMessage('error', function(data) {
      console.log('[Connection] Error received:', data);
      connectBtn.classList.remove('loading');
      connectBtn.disabled = false;
      errorDiv.textContent = (data && data.message) || t('connection.error');
      errorDiv.hidden = false;
    });

    // Listen for 'success' message
    iina.onMessage('success', function(data) {
      console.log('[Connection] Success received');
      connectBtn.classList.remove('loading');
      connectBtn.textContent = 'Connected!';
    });

    // HTTP Proxy: Handle API requests from plugin (bypasses ATS)
    // WebViews can make HTTP requests without ATS blocking
    iina.onMessage('api_request', function(data) {
      console.log('[Connection] API request received:', data);
      var requestId = data.requestId;
      var url = data.url;
      
      fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(function(response) {
        console.log('[Connection] Fetch response status:', response.status);
        return response.text().then(function(text) {
          return {
            statusCode: response.status,
            text: text,
            ok: response.ok
          };
        });
      })
      .then(function(result) {
        console.log('[Connection] Sending api_response:', result.statusCode);
        iina.postMessage('api_response', {
          requestId: requestId,
          success: true,
          statusCode: result.statusCode,
          text: result.text
        });
      })
      .catch(function(err) {
        console.error('[Connection] Fetch error:', err);
        iina.postMessage('api_response', {
          requestId: requestId,
          success: false,
          error: err.message || String(err)
        });
      });
    });
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    var server = serverInput.value.trim();
    var username = usernameInput.value.trim();
    var password = passwordInput.value.trim();

    if (!server || !username || !password) {
      errorDiv.textContent = t('connection.allFields');
      errorDiv.hidden = false;
      return;
    }

    if (server.indexOf('http') !== 0) {
      server = 'http://' + server;
      serverInput.value = server;
    }

    errorDiv.hidden = true;
    connectBtn.classList.add('loading');
    connectBtn.disabled = true;

    if (window.iina && iina.postMessage) {
      // Send as postMessage(name, data) per OpenSubtitles pattern
      iina.postMessage('connect', {
        server: server,
        username: username,
        password: password
      });
    }
  });

  if (window.iina && iina.postMessage) {
    // Signal that window is ready
    iina.postMessage('ready', {});
  }
})();
