# Architecture Overview (Current)

## Project Structure

- **`global.js`**: **Monolithic** Global entry point (approx. 2.8k lines). Contains ALL business logic including:
  - `XtreamAPI` client (custom implementation).
  - State management (`state` object).
  - Storage logic (File system + Preferences).
  - UI communication (`log`, `postMessage`).
- **`main.js`**: Player entry point. Runs in a separate context for each window.
  - Polls `iina.preferences.get('iptv_play_request')` every 500ms.
  - Handles playback resumption and position tracking.
- **`Info.json`**: Plugin manifest. Defines permissions and entry points.
- **`src/`**: **Reference Only**. Contains refactored code (ES modules) that is NOT currently used in the running plugin.
  - Changes in `src/` will NOT affect the plugin unless manually ported to `global.js`.
- **UI Files**:
  - `browser.html`, `connection.html`: Root level UI loaded by `global.js`.

## Data Flow (Current)

1.  **UI (browser.html/connection.html)**:
    - Runs in `standaloneWindow`.
    - Sends `postMessage` to `global.js`.
2.  **Controller (global.js)**:
    - Receives `postMessage`.
    - `XtreamAPI` handles network requests using `iina.utils.exec('/usr/bin/curl', ...)`.
    - Updates `state` variable.
    - Manages persistence (see Storage).
3.  **Playback Handoff**:
    - `global.js` sets `iptv_play_request` in `iina.preferences`.
    - `main.js` detects the change via polling.
    - `main.js` calls `iina.core.open()` or `iina.mpv.command()`.
4.  **Playback Sync**:
    - `main.js` tracks progress and updates `iptv_current_resume` in `preferences`.
    - `global.js` syncs this back to its internal state/storage.

## Key Components

- **Global State**: Managed inside `global.js` variable `state`.
- **Storage**: Hybrid.
  - **Credentials**: Stored in `iptv_credentials.json` in the plugin's data directory (written via `iina.utils.exec` shell commands).
  - **Resume/History**: Stored in `iptv_history.json` / `iptv_resume.json`.
  - **Sync**: `iina.preferences` used primarily for passing messages between `global.js` and `main.js`.
- **API**: `XtreamAPI` defined internally in `global.js` (Prototype based).

## Discrepancies & Technical Debt

- **Monolith**: `global.js` is too large and mixes concerns.
- **Dead Code**: `src/` directory is deceptive; it looks like the source but is ignored.
- **Version Mismatch**: `global.js` headers may differ from `Info.json`.
- **No Build**: Deployment requires manual zipping.
