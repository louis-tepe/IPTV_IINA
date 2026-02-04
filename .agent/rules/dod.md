# Definition of Done (DoD) v8.0.0

## Code Quality

- [ ] Code is modular (logic in `src/`, not monolithic `global.js`).
- [ ] No `console.log` spam (use `Logger` from `src/utils/helpers.js`).
- [ ] No duplicated code (centralized Logger, no redundant functions).
- [ ] Error handling active for all network/file operations.
- [ ] No syntax errors (Lint with standard JS rules).
- [ ] No dead code (commented functions removed).
- [ ] Constants centralized in `src/core/state.js`.

## User Experience

- [ ] UI is responsive and adapts to window resizing.
- [ ] "Native-like" feel (Dark mode support, system fonts).
- [ ] Loading states displayed during network requests.
- [ ] Error messages are user-friendly (not raw stack traces).
- [ ] Internationalization support (FR/EN) with language selector.
- [ ] Accessibility: ARIA attributes, keyboard navigation.
- [ ] CSS optimized (no unused styles, < 700 lines).

## API & Performance

- [ ] Use `iina.http` instead of external commands (curl).
- [ ] No unnecessary complexity (batching, over-engineering).
- [ ] Virtual scrolling for large lists (>50 items).
- [ ] Request deduplication to prevent duplicate API calls.
- [ ] Cache with TTL for performance optimization.

## Verification

- [ ] Feature tested in IINA Standalone Window.
- [ ] Feature tested during playback (if applicable).
- [ ] Restart IINA to verify persistence.
- [ ] Clean log output in IINA Developer Console.
- [ ] Build successful: `npm run build` produces `dist/main.js` and `dist/global.js`.
- [ ] Bundle sizes reasonable (main.js < 10 kB, global.js < 50 kB).

## Documentation

- [ ] `Info.json` version bumped if releasing.
- [ ] `package.json` version bumped to match.
- [ ] `CHANGELOG.md` updated with detailed changes.
- [ ] All modules documented with JSDoc comments.

## Build System

- [ ] Parcel configuration correct (`.parcelrc`).
- [ ] Entry points in `Info.json` point to `dist/` directory.
- [ ] `package.json` targets configured for CommonJS output.
- [ ] No wrapper files (direct bundling from source).
