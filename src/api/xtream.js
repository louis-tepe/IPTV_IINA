/**
 * IINA IPTV Plugin - Xtream Codes API Client
 * @module api/xtream
 */

'use strict';

var REQUEST_TIMEOUT = require('../core/state').REQUEST_TIMEOUT;
var Logger = require('../utils/helpers').Logger;

/**
 * Xtream Codes API Client
 * @constructor
 * @param {Object} creds - Credentials object
 * @param {string} creds.server - Server URL
 * @param {string} creds.username - Username
 * @param {string} creds.password - Password
 */
function XtreamAPI(creds) {
  this.server = creds.server.replace(/\/$/, '');
  this.username = creds.username;
  this.password = creds.password;
  this.activeRequest = null;
}

/**
 * Make an API request with retry logic
 * @param {string} action - API action
 * @param {Object} [params] - Query parameters
 * @param {number} [retries=2] - Number of retries
 * @returns {Promise<any>}
 */
XtreamAPI.prototype.request = function(action, params, retries) {
  retries = retries || 2;
  var self = this;

  // Cancel previous request
  if (this.activeRequest) {
    Logger.log('Cancelling previous request');
    this.activeRequest.cancelled = true;
  }

  var url = this.server + '/player_api.php?username=' + this.username + '&password=' + this.password;
  if (action) url += '&action=' + action;
  if (params) {
    for (var k in params) {
      url += '&' + k + '=' + encodeURIComponent(params[k]);
    }
  }

  var requestId = Date.now();
  this.activeRequest = { id: requestId, cancelled: false };
  var currentRequest = this.activeRequest;

  return new Promise(function(resolve, reject) {
    var attempt = 0;

    function tryRequest() {
      attempt++;
      Logger.log('API Request: ' + action + (attempt > 1 ? ' (retry ' + (attempt - 1) + ')' : ''));

      // Check if iina.http is available
      if (typeof iina === 'undefined' || !iina.http || typeof iina.http.get !== 'function') {
        Logger.error('iina.http.get is not available in this IINA version');
        reject(new Error('iina.http API not available - IINA version may be too old'));
        return;
      }

      // Use iina.http.get with Promise-based API (IINA 1.4.1)
      iina.http.get(url, { timeout: REQUEST_TIMEOUT })
        .then(function(res) {
          if (currentRequest.cancelled) return;

          self.activeRequest = null;

          var text = res.text || res.data || (typeof res === 'string' ? res : null);
          if (!text) {
            if (attempt <= retries) {
              Logger.log('Empty response, retrying... (' + attempt + '/' + retries + ')');
              setTimeout(tryRequest, 1000 * attempt);
            } else {
              reject(new Error('Empty response from server'));
            }
            return;
          }

          try {
            var data = typeof text === 'string' ? JSON.parse(text) : text;
            var sizeKB = typeof text === 'string' ? Math.round(text.length / 1024) : 0;
            Logger.log('Response: ' + (Array.isArray(data) ? data.length + ' items' : 'object') +
                ' (' + sizeKB + ' KB)');
            resolve(data);
          } catch (e) {
            Logger.error('JSON Parse Error: ' + e.message);
            if (attempt <= retries) {
              Logger.log('Parse error, retrying... (' + attempt + '/' + retries + ')');
              setTimeout(tryRequest, 1000 * attempt);
            } else {
              reject(new Error('Invalid JSON response'));
            }
          }
        })
        .catch(function(err) {
          if (currentRequest.cancelled) return;

          self.activeRequest = null;

          Logger.error('HTTP Error: ' + (err.message || err));
          if (attempt <= retries) {
            Logger.log('Request failed, retrying... (' + attempt + '/' + retries + ')');
            setTimeout(tryRequest, 1000 * attempt);
          } else {
            reject(new Error('Network error after ' + retries + ' retries: ' + (err.message || err)));
          }
        });
    }

    tryRequest();
  });
};

/**
 * Get stream URL
 * @param {string} id - Stream ID
 * @param {string} type - Stream type (live, vod, series)
 * @param {string} [ext] - File extension
 * @returns {string}
 */
XtreamAPI.prototype.getStreamUrl = function(id, type, ext) {
  ext = ext || 'ts';
  Logger.log('getStreamUrl: Building URL with id=' + id + ', type=' + type + ', ext=' + ext);
  Logger.log('getStreamUrl: API credentials - server=' + this.server + ', username=' + this.username);

  var finalUrl;

  // Pour les épisodes de séries, utiliser le format spécifique
  if (type === 'series') {
    finalUrl = this.getSeriesEpisodeUrl(id, ext);
  } else {
    // Format standard pour live et vod
    var baseUrl = this.server + '/' + type + '/' + this.username + '/' + this.password + '/' + id;
    finalUrl = baseUrl + '.' + ext;
  }

  Logger.log('getStreamUrl: Final URL = ' + finalUrl);
  return finalUrl;
};

/**
 * Get series episode stream URL
 * Format Xtream Codes API pour les épisodes: /series/username/password/{episode_id}.{ext}
 * @param {string} episodeId - Episode ID
 * @param {string} [ext] - File extension (mp4, mkv, etc.)
 * @returns {string}
 */
XtreamAPI.prototype.getSeriesEpisodeUrl = function(episodeId, ext) {
  ext = ext || 'mp4';
  Logger.log('getSeriesEpisodeUrl: Building URL for episode=' + episodeId + ', ext=' + ext);

  // Format standard Xtream Codes pour les épisodes de séries
  var finalUrl = this.server + '/series/' + this.username + '/' + this.password + '/' + episodeId + '.' + ext;

  Logger.log('getSeriesEpisodeUrl: URL = ' + finalUrl);
  return finalUrl;
};

/**
 * Get EPG for a stream
 * @param {string} streamId - Stream ID
 * @returns {Promise<any>}
 */
XtreamAPI.prototype.getEpg = function(streamId) {
  return this.request('get_short_epg', { stream_id: streamId });
};

module.exports = {
  XtreamAPI: XtreamAPI
};
