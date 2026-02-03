# Technical Stack

- **Core Language:** JavaScript (ES6+, Vanilla).
- **Runtime Environment:** IINA Plugin Runtime (Node-flavor, limited API).
- **Frontend:** HTML5, CSS3 (Vanilla).
- **Frameworks:** None (Vanilla JS/CSS).
- **Platform:** IINA Media Player (macOS).

## Libraries & Tools

- **Bundler:** None (Native support for `require`).
- **Linter:** Standard JS rules.
- **Testing:** Manual end-to-end testing in IINA.

## Constraints

- **No Node.js Native Modules:** `fs` and `http` from Node are not available. Use `iina.file` and `iina.http`.
- **No Browser Globals in Script:** `window`, `document`, `fetch` are unavailable in `main.js`/`global.js`.
- **WebView Isolation:** UI (HTML) runs in separate process. Communication via `postMessage`.
