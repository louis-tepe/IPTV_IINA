(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/shared/utils.js
  function log(msg) {
    const m = LOG_PREFIX + " " + msg;
    iina.console.log(m);
    if (typeof iina.standaloneWindow !== "undefined" && iina.standaloneWindow) {
      try {
        iina.standaloneWindow.postMessage("log", m);
      } catch (e) {
      }
    }
  }
  function logError(msg) {
    const m = LOG_PREFIX + " ERROR: " + msg;
    iina.console.error(m);
    if (typeof iina.standaloneWindow !== "undefined" && iina.standaloneWindow) {
      try {
        iina.standaloneWindow.postMessage("log", "\u274C " + m);
      } catch (e) {
      }
    }
  }
  function base64Encode(str) {
    if (!str) return "";
    try {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
      let encoded = "";
      let c1, c2, c3;
      let i = 0;
      while (i < str.length) {
        c1 = str.charCodeAt(i++);
        c2 = str.charCodeAt(i++);
        c3 = str.charCodeAt(i++);
        encoded += chars.charAt(c1 >> 2);
        encoded += chars.charAt((c1 & 3) << 4 | c2 >> 4);
        if (isNaN(c2)) {
          encoded += "==";
        } else {
          encoded += chars.charAt((c2 & 15) << 2 | c3 >> 6);
          encoded += isNaN(c3) ? "=" : chars.charAt(c3 & 63);
        }
      }
      return encoded;
    } catch (e) {
      iina.console.error("[Base64] Failed to encode: " + e.message);
      return str;
    }
  }
  function base64Decode(str) {
    if (!str) return "";
    try {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
      let output = "";
      let i = 0;
      str = str.replace(/[^A-Za-z0-9+/=]/g, "");
      while (i < str.length) {
        let enc1 = chars.indexOf(str.charAt(i++));
        let enc2 = chars.indexOf(str.charAt(i++));
        let enc3 = chars.indexOf(str.charAt(i++));
        let enc4 = chars.indexOf(str.charAt(i++));
        let chr1 = enc1 << 2 | enc2 >> 4;
        let chr2 = (enc2 & 15) << 4 | enc3 >> 2;
        let chr3 = (enc3 & 3) << 6 | enc4;
        output += String.fromCharCode(chr1);
        if (enc3 !== 64) {
          output += String.fromCharCode(chr2);
        }
        if (enc4 !== 64) {
          output += String.fromCharCode(chr3);
        }
      }
      return output;
    } catch (e) {
      iina.console.error("[Base64] Failed to decode: " + e.message);
      return str;
    }
  }
  var LOG_PREFIX, REQUEST_TIMEOUT, CACHE_TTL;
  var init_utils = __esm({
    "src/shared/utils.js"() {
      LOG_PREFIX = "[IPTV]";
      REQUEST_TIMEOUT = 3e4;
      CACHE_TTL = 3e5;
    }
  });

  // src/global/api.js
  var XtreamAPI;
  var init_api = __esm({
    "src/global/api.js"() {
      init_utils();
      XtreamAPI = class {
        constructor(creds) {
          this.server = creds.server.replace(/\/$/, "");
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
          if (this.activeRequest) {
            log("Cancelling previous request");
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
              log(`API Request: ${action} ${attempt > 1 ? `(retry ${attempt - 1})` : ""}`);
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
                    setTimeout(tryRequest, 1e3 * attempt);
                  } else {
                    reject(new Error(`Request timeout after ${retries} retries`));
                  }
                }
              }, REQUEST_TIMEOUT);
              if (typeof iina === "undefined" || !iina.utils || typeof iina.utils.exec !== "function") {
                clearTimeout(timeoutId);
                reject(new Error("iina.utils.exec API not available"));
                return;
              }
              iina.utils.exec(
                "/usr/bin/curl",
                ["-s", "-L", "--no-keepalive", "--max-time", "30", url],
                null,
                (chunk) => {
                  if (currentRequest.cancelled) return;
                  stdoutChunks.push(chunk);
                  totalBytes += chunk.length;
                },
                (chunk) => {
                }
              ).then((result) => {
                clearTimeout(timeoutId);
                if (currentRequest.cancelled) return;
                self.activeRequest = null;
                if (result.status !== 0) {
                  if (attempt <= retries) {
                    log(`Curl failed (status ${result.status}), retrying...`);
                    setTimeout(tryRequest, 1e3 * attempt);
                    return;
                  }
                  reject(new Error(`Network error after ${retries} retries`));
                  return;
                }
                if (stdoutChunks.length === 0) {
                  reject(new Error("Empty response from server"));
                  return;
                }
                const fullString = stdoutChunks.join("");
                try {
                  const data = JSON.parse(fullString);
                  log(`Response: ${Array.isArray(data) ? data.length + " items" : "object"} (${Math.round(totalBytes / 1024)} KB)`);
                  resolve(data);
                } catch (e) {
                  logError("JSON Parse Error: " + e.message);
                  reject(new Error("Invalid JSON response"));
                }
              }).catch((e) => {
                clearTimeout(timeoutId);
                if (currentRequest.cancelled) return;
                if (attempt <= retries) {
                  log(`Request failed, retrying... (${attempt}/${retries})`);
                  setTimeout(tryRequest, 1e3 * attempt);
                } else {
                  self.activeRequest = null;
                  reject(e);
                }
              });
            }
            tryRequest();
          });
        }
        getStreamUrl(id, type, ext = "ts") {
          log(`getStreamUrl: Building URL with id=${id}, type=${type}, ext=${ext}`);
          if (type === "series") {
            return this.getSeriesEpisodeUrl(id, ext);
          }
          return `${this.server}/${type}/${this.username}/${this.password}/${id}.${ext}`;
        }
        getSeriesEpisodeUrl(episodeId, ext = "mp4") {
          return `${this.server}/series/${this.username}/${this.password}/${episodeId}.${ext}`;
        }
        getEpg(streamId) {
          return this.request("get_short_epg", { stream_id: streamId });
        }
      };
    }
  });

  // src/global/storage.js
  function encodePassword(password) {
    if (!password) return "";
    return base64Encode(password);
  }
  function decodePassword(encoded) {
    if (!encoded) return "";
    return base64Decode(encoded);
  }
  function getCredentialsFilePath() {
    const pluginDir = "/Users/tepe/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin";
    return `${pluginDir}/${CREDENTIALS_FILE}`;
  }
  async function writeCredentialsToFile(credentials) {
    try {
      if (typeof iina === "undefined" || !iina.utils || typeof iina.utils.exec !== "function") {
        log("[Storage] iina.utils.exec not available, skipping file write");
        return false;
      }
      const dataToSave = {
        server: credentials.server || "",
        username: credentials.username || "",
        password: encodePassword(credentials.password || ""),
        rememberMe: credentials.rememberMe || false,
        savedAt: (/* @__PURE__ */ new Date()).toISOString(),
        version: "5.5.0"
      };
      const jsonData = JSON.stringify(dataToSave);
      const filePath = getCredentialsFilePath();
      const mkdirCmd = `/bin/mkdir -p "${filePath.substring(0, filePath.lastIndexOf("/"))}"`;
      const safeJson = jsonData.replace(/'/g, `'"'"'`);
      const writeCmd = `/usr/bin/printf "%s" '${safeJson}' > "${filePath}"`;
      await iina.utils.exec("/bin/sh", ["-c", mkdirCmd], null, () => {
      }, () => {
      });
      const result = await iina.utils.exec("/bin/sh", ["-c", writeCmd], null, () => {
      }, () => {
      });
      if (result && result.status === 0) {
        log(`[Storage] \u2713 Credentials written to file: ${filePath}`);
        return true;
      } else {
        logError(`[Storage] Failed to write credentials file, status: ${result ? result.status : "unknown"}`);
        return false;
      }
    } catch (e) {
      logError(`[Storage] Failed to write credentials to file: ${e.message}`);
      return false;
    }
  }
  async function readCredentialsFromFile() {
    try {
      if (typeof iina === "undefined" || !iina.utils || typeof iina.utils.exec !== "function") return null;
      const filePath = getCredentialsFilePath();
      const stdoutChunks = [];
      const result = await iina.utils.exec(
        "/bin/cat",
        [filePath],
        null,
        (chunk) => stdoutChunks.push(chunk),
        () => {
        }
      );
      if (result && result.status === 0 && stdoutChunks.length > 0) {
        const jsonData = stdoutChunks.join("");
        if (!jsonData || jsonData.trim() === "") return null;
        try {
          const data = JSON.parse(jsonData);
          log("[Storage] \u2713 Credentials loaded from file");
          return {
            server: data.server || "",
            username: data.username || "",
            password: decodePassword(data.password || ""),
            rememberMe: data.rememberMe === true
          };
        } catch (parseErr) {
          logError(`[Storage] Failed to parse credentials file: ${parseErr.message}`);
          return null;
        }
      }
      return null;
    } catch (e) {
      log("[Storage] No credentials file found or read error");
      return null;
    }
  }
  async function deleteCredentialsFile() {
    try {
      const filePath = getCredentialsFilePath();
      await iina.utils.exec("/bin/rm", ["-f", filePath], null, () => {
      }, () => {
      });
      log("[Storage] \u2713 Credentials file deleted");
      return true;
    } catch (e) {
      logError(`[Storage] Failed to delete credentials file: ${e.message}`);
      return false;
    }
  }
  var CREDENTIALS_FILE;
  var init_storage = __esm({
    "src/global/storage.js"() {
      init_utils();
      CREDENTIALS_FILE = "iptv_credentials.json";
    }
  });

  // src/global/state.js
  var state;
  var init_state = __esm({
    "src/global/state.js"() {
      state = {
        api: null,
        isConnected: false,
        credentials: null,
        favorites: {},
        history: [],
        resumePositions: {},
        cache: {
          liveCategories: { data: null, timestamp: 0 },
          vodCategories: { data: null, timestamp: 0 },
          seriesCategories: { data: null, timestamp: 0 },
          streams: {}
        },
        searchDebounceTimer: null
      };
    }
  });

  // src/global/actions.js
  function isCacheValid(cacheEntry) {
    if (!cacheEntry || !cacheEntry.data) return false;
    return Date.now() - cacheEntry.timestamp < CACHE_TTL;
  }
  function getStreamCacheKey(type, categoryId) {
    return `${type}:${categoryId}`;
  }
  async function handleLoad(data) {
    const { type, category } = data;
    log(`[handleLoad] type=${type}, category=${category}`);
    if (!category) {
      await loadCategories(type);
    } else {
      await loadStreams(type, category);
    }
  }
  async function loadCategories(type) {
    if (!state.api) {
      win.postMessage("categories", []);
      return;
    }
    let action, cacheKey;
    if (type === "live") {
      action = "get_live_categories";
      cacheKey = "liveCategories";
    } else if (type === "vod") {
      action = "get_vod_categories";
      cacheKey = "vodCategories";
    } else if (type === "series") {
      action = "get_series_categories";
      cacheKey = "seriesCategories";
    } else {
      win.postMessage("categories", []);
      return;
    }
    if (isCacheValid(state.cache[cacheKey])) {
      log(`[Cache Hit] ${type} categories`);
      win.postMessage("categories", state.cache[cacheKey].data);
      return;
    }
    try {
      const cats = await state.api.request(action);
      if (Array.isArray(cats)) {
        state.cache[cacheKey] = { data: cats, timestamp: Date.now() };
        win.postMessage("categories", cats);
      } else {
        throw new Error("Invalid response");
      }
    } catch (e) {
      logError(`Failed to load ${type} categories: ${e.message}`);
      win.postMessage("categories", []);
      win.postMessage("error", { message: `Failed to load categories: ${e.message}` });
    }
  }
  async function loadStreams(type, catId) {
    if (!state.api) {
      win.postMessage("render", []);
      return;
    }
    let action;
    if (type === "live") action = "get_live_streams";
    else if (type === "vod") action = "get_vod_streams";
    else if (type === "series") action = "get_series";
    else {
      win.postMessage("render", []);
      return;
    }
    const cacheKey = getStreamCacheKey(type, catId);
    if (isCacheValid(state.cache.streams[cacheKey])) {
      log(`[Cache Hit] Streams for ${cacheKey}`);
      win.postMessage("render", state.cache.streams[cacheKey].data);
      return;
    }
    try {
      const streams = await state.api.request(action, { category_id: catId });
      if (Array.isArray(streams)) {
        state.cache.streams[cacheKey] = { data: streams, timestamp: Date.now() };
        win.postMessage("render", streams);
      } else {
        throw new Error("Invalid response");
      }
    } catch (e) {
      logError(`Failed to load streams: ${e.message}`);
      win.postMessage("render", []);
      win.postMessage("error", { message: e.message });
    }
  }
  async function handleLoadSeriesInfo(data) {
    const { seriesId, seriesName } = data;
    if (!state.api) return;
    try {
      const result = await state.api.request("get_series_info", { series_id: seriesId });
      if (result && result.episodes) {
        const payload = {
          seriesId,
          name: result.info && result.info.name || seriesName,
          cover: result.info && result.info.cover || "",
          plot: result.info && result.info.plot || "",
          rating: result.info && result.info.rating || "",
          seasons: result.episodes
        };
        win.postMessage("seriesInfo", payload);
      } else {
        throw new Error("No episodes found");
      }
    } catch (e) {
      logError(`Failed to load series info: ${e.message}`);
      win.postMessage("error", { message: `Failed to load series: ${e.message}` });
    }
  }
  async function handleGetEpg(data) {
    const { streamId } = data;
    if (!state.api) return;
    try {
      const epg = await state.api.getEpg(streamId);
      win.postMessage("epgData", { streamId, data: epg });
    } catch (e) {
      win.postMessage("epgData", { streamId, error: e.message });
    }
  }
  async function handleSearch(data) {
    const { query } = data;
    if (!state.api || !query || query.length < 2) return;
    try {
      const results = [];
      try {
        const live = await state.api.request("get_live_streams");
        if (Array.isArray(live)) results.push(...live.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())).map((s) => ({ ...s, searchType: "live" })));
      } catch (e) {
      }
      try {
        const vod = await state.api.request("get_vod_streams");
        if (Array.isArray(vod)) results.push(...vod.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())).map((s) => ({ ...s, searchType: "vod" })));
      } catch (e) {
      }
      try {
        const series = await state.api.request("get_series");
        if (Array.isArray(series)) results.push(...series.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())).map((s) => ({ ...s, searchType: "series" })));
      } catch (e) {
      }
      win.postMessage("render", results.slice(0, 50));
    } catch (e) {
      win.postMessage("render", []);
    }
  }
  function handleFavorite(data) {
    const { id, type, name } = data;
    if (!id) return;
    if (state.favorites[id]) {
      delete state.favorites[id];
    } else {
      state.favorites[id] = { id, type, name, addedAt: Date.now() };
    }
    win.postMessage("favorites", state.favorites);
  }
  var win;
  var init_actions = __esm({
    "src/global/actions.js"() {
      init_state();
      init_utils();
      win = iina.standaloneWindow;
    }
  });

  // src/global/index.js
  var require_index = __commonJS({
    "src/global/index.js"() {
      init_utils();
      init_api();
      init_storage();
      init_state();
      init_actions();
      var win2 = iina.standaloneWindow;
      var prefs = iina.preferences;
      var menu = iina.menu;
      function showWindow() {
        if (win2) {
          win2.loadFile("browser.html");
          win2.open();
        }
      }
      try {
        if (menu && menu.addItem && menu.item) {
          menu.addItem(menu.item("Open IPTV", showWindow));
        }
      } catch (e) {
        logError("Menu register failed: " + e.message);
      }
      log("=== Plugin v5.5.0-MODULAR starting ===");
      if (win2) {
        win2.onMessage = async (action, data) => {
          log(`Message received: ${action}`);
          switch (action) {
            case "connect":
              await handleConnect(data);
              break;
            case "play":
              handlePlay(data);
              break;
            case "load":
              await handleLoad(data);
              break;
            case "loadSeriesInfo":
              await handleLoadSeriesInfo(data);
              break;
            case "getEpg":
              await handleGetEpg(data);
              break;
            case "search":
              await handleSearch(data);
              break;
            case "favorite":
              handleFavorite(data);
              break;
            default:
              logError(`Unknown action: ${action}`);
          }
        };
      }
      async function handleConnect(creds) {
        log("Connecting...");
        state.credentials = creds;
        state.api = new XtreamAPI(creds);
        try {
          await state.api.request("get_live_categories");
          state.isConnected = true;
          if (creds.rememberMe) {
            await writeCredentialsToFile(creds);
          } else {
            await deleteCredentialsFile();
          }
          win2.postMessage("connected", { success: true });
          log("Connected successfully!");
        } catch (e) {
          logError("Connection failed: " + e.message);
          win2.postMessage("error", { message: "Connection failed: " + e.message });
        }
      }
      function handlePlay(data) {
        const { id, type, ext, name, resumePosition } = data;
        if (!state.api) return;
        const url = state.api.getStreamUrl(id, type, ext);
        const playRequest = {
          url,
          name,
          type,
          streamId: id,
          timestamp: Date.now(),
          resumePosition
        };
        prefs.set("iptv_play_request", JSON.stringify(playRequest));
        log(`Play request sent to main.js for: ${name}`);
      }
      (async () => {
        const saved = await readCredentialsFromFile();
        if (saved) {
          log("Auto-connecting with saved credentials...");
          handleConnect(saved);
        }
      })();
    }
  });
  require_index();
})();
