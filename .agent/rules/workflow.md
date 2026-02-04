# Development Workflow (v8.0.0)

## Versioning

- Format: `Major.Minor.Patch`.
- Follow Semantic Versioning.
- Update `Info.json` `version` and `ghVersion`.
- Update `package.json` `version` to match.

## Commit Strategy

- **Format:** `type(scope): subject`
- **Types:**
  - `feat`: New feature
  - `fix`: Bug fix
  - `refactor`: Code change that neither fixes a bug nor adds a feature
  - `docs`: Documentation only changes
  - `style`: Changes that do not affect the meaning of the code
- **Scope:** `player`, `ui`, `api`, `history`, `epg`.

## Build Process

1. **Development:**
   ```bash
   npm run dev  # Watch mode with auto-rebuild
   ```

2. **Production Build:**
   ```bash
   npm run build  # Create optimized bundles in dist/
   ```

3. **Clean:**
   ```bash
   npm run clean  # Remove dist/ and .parcel-cache/
   ```

## Deployment

1. Bump version in `Info.json`, `package.json`.
2. Update `CHANGELOG.md`.
3. Run `npm run build` to generate `dist/` bundles.
4. Verify build output:
   - `dist/main.js` (< 10 kB)
   - `dist/global.js` (< 50 kB)
5. Create `.iinaplgz` package (if manual distribution).
6. Commit and Tag.

## Code Review Checklist

- [ ] No duplicated code (use Logger from helpers.js)
- [ ] No dead code (commented functions removed)
- [ ] Uses `iina.http` instead of external commands
- [ ] Constants centralized in `src/core/state.js`
- [ ] Proper error handling with try/catch
- [ ] No console.log (use Logger.log/Logger.error)
- [ ] CSS optimized (< 700 lines)
- [ ] i18n strings use `t()` function
- [ ] Build succeeds without errors
