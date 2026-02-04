# Technical Stack

- **Core Language**: JavaScript (ES5/ES6 mixed).
  - `global.js`/`main.js`: **Vanilla JS** (Prototypeu-based classes, `var`/`function`).
  - **Constraints**:
    - No `require` / `import` support in entry points.
    - No `btoa` / `atob` (Must use manual polyfills).
    - No `fetch` / `XMLHttpRequest` (Must use `iina.utils.exec('curl')` or `iina.http`).
- **Runtime Environment**: IINA Plugin Runtime (JavaScriptCore).
- **Frontend**: HTML5, CSS3 (Vanilla), slightly older webkit features.
- **Build System**: **None** (Manual file editing).
- **Platform**: IINA Media Player (macOS).

## Libraries & Tools

- **Bundler**: None.
- **Linter**: None configured.
- **Testing**: Manual only.

## Key Constraints

- **No Node.js Native Modules**: Strict dependency on `iina.*` APIs.
- **File System Access**:
  - `iina.file` is limited.
  - **Workaround**: Heavy reliance on `iina.utils.exec('/bin/sh', ...)` for specific file operations (mkdir, printf).
- **Concurrency**: `main.js` and `global.js` run in separate threads/contexts. They do NOT share memory.

## Best Practices (Current for this Repo)

- **Edit `global.js` directly**: Do not edit `src/` expecting changes to propagate.
- **Use Shell Commands for File IO**: `printf` is used to write JSON to avoid shell macro expansion issues.
- **Logging**: Use the custom `log()` helper in `global.js` which sends logs to both `iina.console` and the UI debug window.
