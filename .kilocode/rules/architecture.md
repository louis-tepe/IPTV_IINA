# Architecture Overview

## Project Structure

- `Info.json`: Plugin manifest (permissions, metadata).
- `global.js`: Global entry point (runs once on IINA start). Handles app lifecycle and global menus.
- `main.js`: Player entry point (runs per player window). Handles playback events.
- `src/`: Core logic modules.
  - `api/`: Networking and external service integration.
  - `managers/`: Business logic (History, Favorites, EPG).
  - `ui/`: View logic helpers.
- `ui/`: HTML/CSS assets for WebViews (`browser.html`, `connection.html`).

## Data Flow

1. **User Action (UI):** Click in `standaloneWindow` (WebView) -> `iina.postMessage`.
2. **Controller (Plugin Script):** `onMessage` in `global.js`/`main.js` receives event.
3. **Logic:** Script calls `src/managers/*` to process data.
4. **Update (UI):** Script calls `win.postMessage` -> WebView `onMessage` updates DOM.

## Key Components

- **Standalone Window:** Main interface for browsing content.
- **Player Interface:** OSD and controls during playback (`main.js`).
- **Storage:** `iina.preferences` for simple data, `iina.file` for complex JSON storage.
