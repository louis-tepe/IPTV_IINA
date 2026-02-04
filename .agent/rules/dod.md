# Definition of Done (DoD)

## Code Quality

- [ ] **Monolithic Integrity**: `global.js` must be self-contained. No missing dependencies that are only in `src/`.
- [ ] **Syntax Check**: perform a manual verify of `global.js` (e.g. paste into a validator or check for red squiggles) since there is no build step.
- [ ] **Error Handling**: `XtreamAPI` requests must handle timeouts and 4xx/5xx errors gracefully without crashing the plugin.

## User Experience

- [ ] **Startup Speed**: Plugin should initialize without blocking the main thread (less than 1s).
- [ ] **Feedback**: UI must show a "Loading..." state for any network request > 200ms.
- [ ] **Persistence**:
  - Login credentials must survive IINA restart.
  - Last played channel/series must be resumable.

## Versioning & Release

- [ ] **Version Match**: `Info.json` version == `global.js` `PLUGIN_VERSION`.
- [ ] **Clean Package**: `src/` and `.git` folders are NOT included in the final distribution zip.

## Verification

- [ ] **Manual Test**: Install the modified plugin in IINA and verify:
  1.  Login works.
  2.  Live TV plays.
  3.  A generic "Series" episode plays.
  4.  Close and Re-open IINA -> Credentials are remembered.
