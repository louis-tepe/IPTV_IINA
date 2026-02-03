# Development Workflow

## Versioning

- Format: `Major.Minor.Patch`.
- Follow Semantic Versioning.
- Update `Info.json` `version` and `ghVersion`.

## Commit Strategy

- **Format:** `type(scope): subject`
- **Types:**
  - `feat`: New feature
  - `fix`: Bug fix
  - `refactor`: Code change that neither fixes a bug nor adds a feature
  - `docs`: Documentation only changes
  - `style`: Changes that do not affect the meaning of the code
- **Scope:** `player`, `ui`, `api`, `history`, `epg`.

## Deployment

1. Bump version in `Info.json`.
2. Update `CHANGELOG.md`.
3. Create `.iinaplgz` package (if manual distribution).
4. Commit and Tag.
