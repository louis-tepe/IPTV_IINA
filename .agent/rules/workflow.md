# Development Workflow

## Versioning

- **Double Update Required**:
  1. Update `version` in `Info.json`.
  2. Update `PLUGIN_VERSION` constant at the top of `global.js`.
  - Ensure they match!

## Build Process

- **No Build Step**.
- Edit `global.js`, `main.js`, and HTML files directly in the root directory.
- `src/` files are for reference only.

## Deployment

1.  Bump versions (see above).
2.  **Clean**: Remove `.DS_Store` files and `src/` folder (optional but recommended) from the distribution package.
3.  **Pack**:
    - Select all root files (excluding `.git`, `.agent`).
    - Compress to `PluginName.zip`.
    - Rename to `PluginName.iinaplg` (or `.iinaplgz` if using the CLI).
    - OR use CLI: `npx iina-plugin pack` (if configured, likely manual currently).

## Code Review Checklist

- [ ] **Verification**: Did you edit `global.js` and not `src/`?
- [ ] **Permissions**: Check `Info.json` permissions if adding new connection types.
- [ ] **Syntax**: Manual check `global.js` for syntax errors (bracket matching) as there is no compiler to catch them.
- [ ] **Polling**: Ensure `main.js` or `global.js` intervals are not too aggressive (<500ms).
- [ ] **Persistence**: Verify critical data is saved to `iptv_*.json` files.
