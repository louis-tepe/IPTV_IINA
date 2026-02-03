# IINA Plugin System Instructions (2026)

## 1. Critical Architecture & Constraints

- **Runtime Environment**: Plugins run in a limited JavaScript environment.
  - **NO** full Node.js API (no `fs`, `net`, `http` servers).
  - **NO** Browser globals in the main process (no `window`, `document`, `fetch`, `localStorage`).
- **UI Isolation**: GUI elements (Standalone Window, Sidebar, Overlay) run in **separate WebViews**.
  - They **cannot** access the plugin's variables directly.
  - Communication is strictly asynchronous via `postMessage`.
- **Dependency Management**:
  - **MANDATORY**: Use a Bundler (Parcel/Webpack) to use NPM packages.
  - The raw runtime does not resolve `node_modules` hierarchically.

## 2. Project Structure

Standard layout for a modern, production-ready plugin:

```
Author.PluginName/
├── Info.json          # Manifest (Required)
├── Preferences.xib    # Native UI (Optional)
├── package.json       # Dev dependencies (Parcel, TypeScript)
├── dist/              # Bundled output
│   ├── main.js        # Per-window entry point
│   └── global.js      # Global entry point (optional)
└── src/
    ├── main.ts        # Entry source
    ├── global.ts      # Global source
    ├── ui/            # React/Vue components for WebViews
    └── assets/
```

### Info.json Schema

```json
{
  "name": "Plugin Name",
  "identifier": "com.author.pluginname",
  "version": "1.0.0",
  "ghRepo": "author/repo",
  "ghVersion": "1.0.0",
  "entry": "dist/main.js",
  "globalEntry": "dist/global.js",
  "preferencePages": [
    { "id": "general", "title": "General", "xib": "Preferences.xib" }
  ],
  "permissions": [
    "network",
    "file-system",
    "standalone-window",
    "show-overlay",
    "show-alert",
    "menu",
    "preferences",
    "playlist",
    "sidebar"
  ]
}
```

## 3. Build Configuration & Tooling

### Critical `package.json` Configuration (Parcel)

To ensure compatibility with IINA's runtime (CommonJS), configure targets specifically:

```json
{
  "scripts": {
    "dev": "parcel watch src/main.ts --target main --no-hmr",
    "build": "parcel build src/main.ts --target main"
  },
  "targets": {
    "main": {
      "distDir": "./dist",
      "includeNodeModules": true,
      "context": "node",
      "outputFormat": "commonjs"
    }
  },
  "devDependencies": {
    "parcel": "latest",
    "iina-plugin-definition": "latest"
  }
}
```

### TypeScript Setup

1. Install types: `npm install --save-dev iina-plugin-definition`
2. Create `tsconfig.json` (or `jsconfig.json`):
   ```json
   {
     "compilerOptions": { "target": "ES6", "moduleResolution": "node" },
     "include": ["src/**/*"]
   }
   ```

### Debugging

- Enable **Safari Developer Menu**: Preferences > Advanced > Show Develop menu.
- Open Inspector: **Develop > IINA > [Plugin Name]**.
- Use `iina.console.log` to see output in the inspector console.

## 4. Core API Reference (`iina.*`)

Use these modules instead of standard JS/Node APIs.

### `iina.core` & `iina.mpv` (Playback)

```javascript
// Controls
iina.core.open("url");
iina.core.iosd("Message"); // Interactive OSD

// mpv direct access
iina.mpv.set("volume", 50);
const pos = iina.mpv.getNumber("time-pos");
iina.mpv.command("seek", ["10", "relative"]);
```

### `iina.event` (Events)

```javascript
// IINA Events
iina.event.on("iina.file-loaded", () => {
  console.log(iina.core.file);
});
iina.event.on("iina.window-will-close", () => cleanup());

// MPV Events
iina.event.on("mpv.pause", () => handlePause());
iina.event.on("mpv.time-pos.changed", (v) => updateUI(v));
```

### `iina.http` (Networking)

**Do not use `fetch`.**

```javascript
// GET
iina.http.get("https://api.com", { timeout: 5000 }, (err, res) => {
  if (err) return iina.console.error(err.message);
  const data = JSON.parse(res.text);
});

// POST
iina.http.post(
  "https://api.com",
  {
    body: JSON.stringify({ foo: "bar" }),
    headers: { "Content-Type": "application/json" },
  },
  callback,
);
```

### `iina.preferences` (Storage)

```javascript
// Persist user settings
iina.preferences.set("token", "12345");
const token = iina.preferences.get("token");
iina.preferences.sync(); // Force save
```

### `iina.menu` & `iina.sidebar` (System UI)

```javascript
// Menu Item
iina.menu.addItem(
  iina.menu.item(
    "My Action",
    () => {
      iina.console.log("Clicked");
    },
    { key: "d", modifiers: ["cmd"] },
  ),
);

// Sidebar Tab
iina.sidebar.create({
  tabId: "my-tab",
  html: "dist/ui/sidebar.html", // bundled HTML
  onMessage: (msg) => handleSidebarMsg(msg),
});
```

### `iina.standaloneWindow` & `iina.overlay` (Custom UI)

```javascript
// Standalone Window
const win = iina.standaloneWindow.open({
  title: "Title",
  width: 400,
  height: 300,
  resizable: true,
  onMessage: (msg, data) => processAction(msg, data),
});
win.loadFile("dist/ui/index.html");
win.simpleMode(); // Removes chrome
win.postMessage("UPDATE", { payload: 123 });

// Overlay (OSD-like HTML)
iina.overlay.show({
  html: "<div>Hello</div>",
  position: "center",
});
```

### `iina.playlist` & `iina.file`

```javascript
// Playlist
iina.playlist.add("url", "Title");
iina.playlist.playAt(0);

// File System (Limited, use absolute paths)
// Returns Promise
const content = await iina.file.read("/absolute/path");
await iina.file.write("/absolute/path", "content");
```

### `iina.ws` (WebSockets)

```javascript
const ws = new iina.ws("wss://echo.websocket.org");
ws.onopen = () => ws.send("Hello");
ws.onmessage = (e) => iina.console.log(e.data);
```

### `iina.global` (Instance Management)

**Only available in `global.js`.**

```javascript
const player = iina.global.newWindow({ disableUI: false });
player.open("https://video.mp4");
player.postMessage("cmd", { a: 1 });
```

## 5. UI Communication Pattern

**In `main.js` (Plugin Process)**:

```javascript
window.onMessage = (msg, data) => handle(data);
window.postMessage("update", state);
```

**In `index.html` (WebView Process)**:

```javascript
// Send to Main
iina.postMessage("action", { id: 1 });

// Receive from Main
iina.onMessage("update", (data) => {
  render(data.payload);
});
```

## 6. Development Checklist

- [ ] **Permissions**: Are used APIs declared in `Info.json`?
- [ ] **Entry Points**: `main.js` (per-window) vs `global.js` (app-level).
- [ ] **Paths**: Are you using absolute paths? (use `__dirname` logic or `iina.utils`).
- [ ] **Logging**: Use `iina.console.log`.
- [ ] **Error Handling**: Check `err` in callbacks.
