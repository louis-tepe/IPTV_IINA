/**
 * IINA IPTV Plugin - Xtream Codes API Client
 * @module api/xtream
 */

'use strict';

const { REQUEST_TIMEOUT } = require('../core/state');
const { Logger } = require('../utils/helpers');

/**
 * Xtream Codes API Client
 */
class XtreamAPI {
  /**
   * @param {Object} creds - Credentials object
   * @param {string} creds.server - Server URL
   * @param {string} creds.username - Username
   * @param {string} creds.password - Password
   */
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
  async request(action, params, retries = 2) {
    // Cancel previous request
    if (this.activeRequest) {
      Logger.log('Cancelling previous request');
      this.activeRequest.cancelled = true;
    }

    let url = `${this.server}/player_api.php?username=${this.username}&password=${this.password}`;
    if (action) url += `&action=${action}`;
    if (params) {
      for (const k in params) {
        url += `&${k}=${encodeURIComponent(params[k])}`;
      }
    }

    const requestId = Date.now();
    this.activeRequest = { id: requestId, cancelled: false };
    const currentRequest = this.activeRequest;

    let attempt = 0;

    // Retry loop using async/await
    while (attempt <= retries) {
      attempt++;
      Logger.log(`API Request: ${action}${attempt > 1 ? ` (retry ${attempt - 1})` : ''}`);

      if (typeof iina === 'undefined' || !iina.http || typeof iina.http.get !== 'function') {
        Logger.error('iina.http.get is not available in this IINA version');
        throw new Error('iina.http API not available - IINA version may be too old');
      }

      try {
        if (currentRequest.cancelled) return;

        const res = await iina.http.get(url, { timeout: REQUEST_TIMEOUT });

        if (currentRequest.cancelled) return;
        this.activeRequest = null;

        const text = res.text || res.data || (typeof res === 'string' ? res : null);
        if (!text) {
          throw new Error('Empty response from server');
        }

        const data = typeof text === 'string' ? JSON.parse(text) : text;
        const sizeKB = typeof text === 'string' ? Math.round(text.length / 1024) : 0;
        
        Logger.log(`Response: ${Array.isArray(data) ? data.length + ' items' : 'object'} (${sizeKB} KB)`);
        return data;

      } catch (e) {
        if (currentRequest.cancelled) return;

        const isLastAttempt = attempt > retries;
        const errorMsg = e.message || e;
        Logger.error(`Request failed: ${errorMsg}`);

        if (isLastAttempt) {
           this.activeRequest = null;
           throw new Error(`Network error after ${retries} retries: ${errorMsg}`);
        }

        // Wait before retry (exponential backoff-ish: 1s, 2s, 3s...)
        Logger.log(`Retrying in ${attempt}s...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Get stream URL
   * @param {string} id - Stream ID
   * @param {string} type - Stream type (live, vod, series)
   * @param {string} [ext] - File extension
   * @returns {string}
   */
  getStreamUrl(id, type, ext = 'ts') {
    Logger.log(`getStreamUrl: Building URL with id=${id}, type=${type}, ext=${ext}`);
    Logger.log(`getStreamUrl: API credentials - server=${this.server}, username=${this.username}`);

    let finalUrl;

    // Pour les épisodes de séries, utiliser le format spécifique
    if (type === 'series') {
      finalUrl = this.getSeriesEpisodeUrl(id, ext);
    } else {
      // Format standard pour live et vod
      const baseUrl = `${this.server}/${type}/${this.username}/${this.password}/${id}`;
      finalUrl = `${baseUrl}.${ext}`;
    }

    Logger.log(`getStreamUrl: Final URL = ${finalUrl}`);
    return finalUrl;
  }

  /**
   * Get series episode stream URL
   * Format Xtream Codes API pour les épisodes: /series/username/password/{episode_id}.{ext}
   * @param {string} episodeId - Episode ID
   * @param {string} [ext] - File extension (mp4, mkv, etc.)
   * @returns {string}
   */
  getSeriesEpisodeUrl(episodeId, ext = 'mp4') {
    Logger.log(`getSeriesEpisodeUrl: Building URL for episode=${episodeId}, ext=${ext}`);

    // Format standard Xtream Codes pour les épisodes de séries
    const finalUrl = `${this.server}/series/${this.username}/${this.password}/${episodeId}.${ext}`;

    Logger.log(`getSeriesEpisodeUrl: URL = ${finalUrl}`);
    return finalUrl;
  }

  /**
   * Get EPG for a stream
   * @param {string} streamId - Stream ID
   * @returns {Promise<any>}
   */
  getEpg(streamId) {
    return this.request('get_short_epg', { stream_id: streamId });
  }
}

module.exports = {
  XtreamAPI
};
