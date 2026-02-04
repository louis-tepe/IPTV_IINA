# IINA Plugin System Instructions (2026 - IINA 1.4.1)

> **Last Updated**: February 2026  
> **IINA Version**: 1.4.1  
> **Docs**: [iina.io/plugin/documentation](https://iina.io/plugin/documentation/)

> [!IMPORTANT]
> **Project Specific Deviation**: This project (`IPTV_IINA`) does **NOT** follow the standard `dist/` vs `src/` structure described below.
>
> - It uses a **Monolithic** `global.js` in the root directory.
> - The `src/` directory is for reference only and is not built.
> - There is **NO** `package.json` or build step.
> - Consult `architecture.md` for the actual project structure.

## 1. Critical Architecture & Constraints

- **Runtime**: JavaScriptCore (Safari engine), supports **ES2015 (ES6)** on macOS 10.11+.
  - **NO** Node.js API (`fs`, `net`, `http` servers).
  - **NO** Browser globals (`window`, `document`, `fetch`, `localStorage`).
- **UI Isolation**: WebViews (Sidebar, Overlay, Window) cannot access plugin variables. Use `postMessage`/`onMessage`.
- **Dependencies**: **MANDATORY** bundler (Parcel/Webpack) for NPM packages.

## 2. Project Structure

```
Author.PluginName/
├── Info.json          # Manifest (Required)
├── Preferences.xib    # Native UI (Optional)
├── package.json
├── dist/
│   ├── main.js        # Per-window entry
│   └── global.js      # App-level entry (optional)
└── src/
```

### Info.json Schema

```json
{
  "name": "Plugin Name",
  "identifier": "com.author.pluginname",
  "version": "1.0.0",
  "author": "Author Name",
  "ghRepo": "author/repo",
  "ghVersion": "1.0.0",
  "entry": "dist/main.js",
  "globalEntry": "dist/global.js",
  "permissions": [
    "show-osd",
    "show-alert",
    "video-overlay",
    "network-request",
    "file-system"
  ]
}
```

### Permissions Reference

| Permission        | Required For                            |
| ----------------- | --------------------------------------- |
| `show-osd`        | `iina.core.osd()`                       |
| `show-alert`      | `iina.utils` alert/dialog methods       |
| `video-overlay`   | `iina.overlay` module                   |
| `network-request` | `iina.http` module                      |
| `file-system`     | `iina.file` module, `iina.utils.exec()` |

## 3. Build Configuration

### package.json (Parcel)

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

### CLI Tool

```bash
npx iina-plugin create my-plugin  # Create new plugin
npx iina-plugin pack              # Pack for distribution (.iinaplgz)
```

### Debugging

- Safari: **Develop > IINA > [Plugin Name]**
- Use `iina.console.log` for output.

## 4. Core API Reference (`iina.*`)

```javascript
const { core, event, mpv, console } = iina;
```

### `iina.core` (Playback)

Sub-modules: `core.audio`, `core.video`, `core.subtitle`, `core.window`, `core.status`

```javascript
iina.core.open("url");
iina.core.osd("Message"); // Requires 'show-osd'
iina.core.pause();
iina.core.resume();
iina.core.stop();
iina.core.seek(10, true); // Relative seek (exact=true)
iina.core.seekTo(120); // Absolute seek
iina.core.setSpeed(1.5);
iina.core.getChapters();
iina.core.playChapter(2);

// Window control
iina.core.window.loaded; // Check if ready
iina.core.window.fullscreen = true;
iina.core.window.pip = true;
iina.core.window.ontop = true;

// Status
iina.core.status.paused;
iina.core.status.title;
iina.core.status.duration;
```

### `iina.mpv` (MPV Direct)

```javascript
iina.mpv.getNumber("volume");
iina.mpv.getFlag("pause");
iina.mpv.getString("filename");
iina.mpv.set("volume", 80);
iina.mpv.command("seek", ["10", "relative"]);
iina.mpv.addHook("on_load", 50, () => {
  /* ... */
});
```

### `iina.event` (Events)

```javascript
// IINA Events
iina.event.on("iina.file-loaded", () => {});
iina.event.on("iina.window-will-close", () => {});
iina.event.on("iina.pip.changed", (inPIP) => {});

// MPV Property Changes
iina.event.on("mpv.pause.changed", (isPaused) => {});
iina.event.on("mpv.time-pos.changed", (pos) => {});
iina.event.on("mpv.volume.changed", (vol) => {});
```

### `iina.http` (Networking)

**Requires**: `network-request` permission. **MANDATORY: Use instead of curl/fetch.**

```javascript
iina.http.get("url", { timeout: 5000, headers: {} }, (err, res) => {
  if (err) return;
  const data = JSON.parse(res.text);
});

iina.http.post(
  "url",
  { body: JSON.stringify({}), headers: { "Content-Type": "application/json" } },
  callback,
);

iina.http.download("url", "/path/to/file", (err) => {});

const xmlrpc = new iina.http.XMLRPCClient("url");
xmlrpc.call("method", [args], (err, result) => {});
```

❌ **Forbidden**: `iina.utils.exec('/usr/bin/curl', ...)`, `fetch`, external HTTP libraries

### `iina.ws` (WebSockets)

```javascript
const ws = new iina.ws("wss://...");
ws.onopen = () => ws.send("Hello");
ws.onmessage = (e) => console.log(e.data);
ws.onerror = (e) => {};
ws.onclose = () => {};
ws.close();
```

### `iina.file` (File System)

**Requires**: `file-system` permission. **Always use absolute paths.**

```javascript
const content = await iina.file.read("/path");
await iina.file.write("/path", "content");
const exists = await iina.file.exists("/path");
const files = await iina.file.list("/path");
```

### `iina.utils` (Utilities)

**Requires**: `file-system` for `exec()`, `show-alert` for dialogs.

```javascript
iina.utils.exec("/usr/bin/cmd", ["args"], (err, stdout, stderr) => {});
iina.utils.showAlert("Title", "Msg", ["OK", "Cancel"], (idx) => {});
iina.utils.chooseFile(["mp4", "mkv"], (path) => {});
iina.utils.chooseFolder((path) => {});
```

### `iina.preferences` (Storage)

```javascript
iina.preferences.set("key", value);
const val = iina.preferences.get("key");
iina.preferences.sync();
```

### `iina.console` (Logging)

```javascript
iina.console.log("info");
iina.console.warn("warning");
iina.console.error("error");
```

### `iina.menu` (Menu Items)

```javascript
iina.menu.addItem(
  iina.menu.item("Action", () => {}, { key: "d", modifiers: ["cmd"] }),
);
iina.menu.addItem(iina.menu.separator());
const submenu = iina.menu.createSubmenu("Submenu");
submenu.addItem(iina.menu.item("Item", () => {}));
iina.menu.addItem(submenu);
```

### `iina.playlist` (Playlist)

```javascript
iina.playlist.add("url", "Title");
const items = iina.playlist.getItems();
iina.playlist.playAt(0);
iina.playlist.remove(2);
iina.playlist.clear();
```

### `iina.subtitle` (Subtitle Provider)

```javascript
iina.subtitle.register({
  name: "Provider Name",
  id: "provider-id",
  search: async () =>
    results.map((s) => iina.subtitle.item(s, { title, language })),
  description: (item) => [
    item.data.title,
    item.data.language,
    item.data.source,
  ],
  download: async (item) => [downloadedPath],
});
```

### `iina.input` (Input Capture)

**Main entry only.**

```javascript
iina.input.onKeyDown((e) => {
  if (e.key === "l" && e.modifiers.includes("cmd")) {
    return true;
  } // handled
  return false;
}, iina.input.PRIORITY_LOW);

iina.input.onMouseDown((e) => {
  console.log(e.x, e.y);
  return false;
});
```

## 5. UI Modules (WebView-based)

### `iina.overlay` (Video Overlay)

**Requires**: `video-overlay` permission

```javascript
iina.overlay.simpleMode();
iina.overlay.setContent("<div>...</div>");
iina.overlay.setStyle("div { color: white; }");
iina.overlay.loadFile("dist/ui/overlay.html");
iina.overlay.show();
iina.overlay.hide();
iina.overlay.setOpacity(0.8);
iina.overlay.setClickable(true);
iina.overlay.postMessage({ type: "update" });
iina.overlay.onMessage((msg) => {});
```

### `iina.standaloneWindow` (Separate Window)

```javascript
const win = iina.standaloneWindow.open();
win.setProperty("title", "Title");
win.setFrame({ x: 100, y: 100, width: 400, height: 300 });
win.loadFile("dist/ui/window.html");
win.simpleMode();
win.setContent("<div>...</div>");
win.postMessage({ action: "refresh" });
win.onMessage((msg) => {});
win.close();
```

### `iina.sidebar` (Sidebar Tab)

```javascript
iina.sidebar.create({
  tabId: "my-tab",
  title: "Title",
  html: "dist/ui/sidebar.html",
  onMessage: (msg) => {},
});
iina.sidebar.postMessage("my-tab", { type: "update" });
```

### WebView JavaScript (Inside HTML)

```javascript
iina.postMessage({ action: "clicked" });
iina.onMessage("update", (data) => {});
```

## 6. Global Entry (`iina.global`)

**Only in `global.js`** (specified by `globalEntry`).

```javascript
const player = iina.global.newWindow({ disableUI: false });
player.open("url");
player.pause();
player.resume();
player.seek(30);
player.postMessage("cmd", {});
player.onMessage((msg) => {});

iina.global.onNewWindow((window) => {});
```

## 7. Distribution

```bash
npx iina-plugin pack  # Creates PluginName.iinaplgz
```

- Install: Double-click `.iinaplgz` or via IINA plugin manager
- Auto-updates: Set `ghRepo` and `ghVersion` in Info.json

## 8. Checklist

- [ ] Permissions declared in `Info.json`
- [ ] Using `iina.http` (NOT curl/fetch)
- [ ] Using `iina.console.log` (NOT console.log)
- [ ] Using absolute paths
- [ ] Checking `err` in callbacks
- [ ] Using `postMessage`/`onMessage` for WebView
- [ ] Bundled with CommonJS output
