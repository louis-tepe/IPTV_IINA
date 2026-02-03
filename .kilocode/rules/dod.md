# Definition of Done (DoD)

## Code Quality

- [ ] Code is modular (logic in `src/`, not monolithic `global.js`).
- [ ] No `console.log` spam (use `iina.console.log` with meaningful messages).
- [ ] Error handling active for all network/file operations.
- [ ] No syntax errors (Lint with standard JS rules).

## User Experience

- [ ] UI is responsive and adapts to window resizing.
- [ ] "Native-like" feel (Dark mode support, system fonts).
- [ ] Loading states displayed during network requests.
- [ ] Error messages are user-friendly (not raw stack traces).

## Verification

- [ ] Feature tested in IINA Standalone Window.
- [ ] Feature tested during playback (if applicable).
- [ ] Restart IINA to verify persistence.
- [ ] Clean log output in IINA Developer Console.

## Documentation

- [ ] `Info.json` version bumped if releasing.
- [ ] `CHANGELOG.md` updated.
