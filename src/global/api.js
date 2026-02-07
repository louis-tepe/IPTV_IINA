import { log, logError, REQUEST_TIMEOUT } from '../shared/utils.js';

/**
 * Xtream Codes API Client
 */
export class XtreamAPI {
  constructor(creds) {
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
  request(action, params = {}, retries = 2) {
    const self = this;
    
    // Cancel previous request
    if (this.activeRequest) {
      log('Cancelling previous request');
      this.activeRequest.cancelled = true;
    }

    let url = `${this.server}/player_api.php?username=${this.username}&password=${this.password}`;
    if (action) url += `&action=${action}`;
    
    for (const k in params) {
      url += `&${k}=${encodeURIComponent(params[k])}`;
    }

    const requestId = Date.now();
    this.activeRequest = { id: requestId, cancelled: false };
    const currentRequest = this.activeRequest;

    return new Promise((resolve, reject) => {
      let attempt = 0;
      
      function tryRequest() {
        attempt++;
        log(`API Request: ${action} ${attempt > 1 ? `(retry ${attempt - 1})` : ''}`);
        
        const stdoutChunks = [];
        let totalBytes = 0;
        let timeoutId = null;
        
        timeoutId = setTimeout(() => {
          if (!currentRequest.cancelled) {
            currentRequest.cancelled = true;
            self.activeRequest = null;
            if (attempt <= retries) {
              log(`Request timeout, retrying... (${attempt}/${retries})`);
              currentRequest.cancelled = false;
              setTimeout(tryRequest, 1000 * attempt); // Exponential backoff
            } else {
              reject(new Error(`Request timeout after ${retries} retries`));
            }
          }
        }, REQUEST_TIMEOUT);

        if (typeof iina === 'undefined' || !iina.utils || typeof iina.utils.exec !== 'function') {
          clearTimeout(timeoutId);
          reject(new Error('iina.utils.exec API not available'));
          return;
        }
        
        iina.utils.exec('/usr/bin/curl', ['-s', '-L', '--no-keepalive', '--max-time', '30', url], null, 
          (chunk) => {
            if (currentRequest.cancelled) return;
            stdoutChunks.push(chunk);
            totalBytes += chunk.length;
          },
          (chunk) => {
            // stderr ignored
          }
        ).then((result) => {
          clearTimeout(timeoutId);
          
          if (currentRequest.cancelled) return;
          self.activeRequest = null;

          if (result.status !== 0) {
            if (attempt <= retries) {
              log(`Curl failed (status ${result.status}), retrying...`);
              setTimeout(tryRequest, 1000 * attempt);
              return;
            }
            reject(new Error(`Network error after ${retries} retries`));
            return;
          }

          if (stdoutChunks.length === 0) {
            reject(new Error('Empty response from server'));
            return;
          }

          const fullString = stdoutChunks.join('');
          
          try {
            const data = JSON.parse(fullString);
            log(`Response: ${Array.isArray(data) ? data.length + ' items' : 'object'} (${Math.round(totalBytes/1024)} KB)`);
            resolve(data);
          } catch (e) {
            logError('JSON Parse Error: ' + e.message);
            reject(new Error('Invalid JSON response'));
          }
        }).catch((e) => {
          clearTimeout(timeoutId);
          if (currentRequest.cancelled) return;
          
          if (attempt <= retries) {
            log(`Request failed, retrying... (${attempt}/${retries})`);
            setTimeout(tryRequest, 1000 * attempt);
          } else {
            self.activeRequest = null;
            reject(e);
          }
        });
      }
      
      tryRequest();
    });
  }

  getStreamUrl(id, type, ext = 'ts') {
    log(`getStreamUrl: Building URL with id=${id}, type=${type}, ext=${ext}`);
    
    if (type === 'series') {
      return this.getSeriesEpisodeUrl(id, ext);
    }
    // Map 'vod' to 'movie' for Xtream Codes API URL format
    const urlPath = type === 'vod' ? 'movie' : type;
    return `${this.server}/${urlPath}/${this.username}/${this.password}/${id}.${ext}`;
  }

  getSeriesEpisodeUrl(episodeId, ext = 'mp4') {
    return `${this.server}/series/${this.username}/${this.password}/${episodeId}.${ext}`;
  }

  getEpg(streamId) {
    return this.request('get_short_epg', { stream_id: streamId });
  }
}
