# Technical Stack (v8.0.0)

- **Core Language:** JavaScript (ES6+, Vanilla).
- **Runtime Environment:** IINA Plugin Runtime (Node-flavor, limited API).
- **Frontend:** HTML5, CSS3 (Vanilla).
- **Frameworks:** None (Vanilla JS/CSS).
- **Platform:** IINA Media Player (macOS).

## Libraries & Tools

- **Bundler:** Parcel 2.x with CommonJS output for IINA runtime compatibility.
- **Linter:** Standard JS rules.
- **Testing:** Manual end-to-end testing in IINA.
- **Build Tools:** Terser optimizer for production builds.

## Constraints

- **No Node.js Native Modules:** `fs` and `http` from Node are not available. Use `iina.file` and `iina.http`.
- **No Browser Globals in Script:** `window`, `document`, `fetch` are unavailable in `main.js`/`global.js`.
- **WebView Isolation:** UI (HTML) runs in separate process. Communication via `postMessage`.

## Best Practices

- **Use `iina.http`** for all network requests (not curl or fetch).
- **Central Logger** in `src/utils/helpers.js` for consistent logging.
- **Modular structure** with clear separation (api, managers, core, utils).
- **Virtual scrolling** for large lists to maintain performance.
- **Request deduplication** to prevent duplicate API calls.
- **Cache with TTL** for performance optimization.
