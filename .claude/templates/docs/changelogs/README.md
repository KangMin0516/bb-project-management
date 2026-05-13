# Changelog Templates

Templates used when creating a new domain changelog in `docs/changelogs/`.

## Files

- [`CHANGELOG_TEMPLATE.md`](./CHANGELOG_TEMPLATE.md) — the canonical per-domain changelog skeleton. Copy it to `docs/changelogs/<domain>-changelog.md` and fill in.

## How to use

1. **A new feature area has emerged** (a new module under `packages/api/src/`, a new top-level page in `packages/web/src/pages/`, or a new integration).
2. Copy `CHANGELOG_TEMPLATE.md` to `docs/changelogs/<domain>-changelog.md`.
3. Fill out **Owns** and **Surface** sections based on the current code. Be specific — list file paths and table names.
4. Add the introductory entry to **Timeline** with the commit that introduced the domain.
5. **Add a row to [`docs/changelogs/README.md`](../../../../docs/changelogs/README.md) "Index"** so the new file is discoverable.

## Conventions

- **One file per domain.** If a feature spans two domains (e.g., "issue-spec links" — touches both issues and specifications), prefer the domain that owns the *primary* concept and cross-link from the other.
- **Newest first** within each file.
- **Date format**: `YYYY-MM-DD`.
- **Commit reference**: short SHA in parentheses after the title. No URLs (they rot).
- **Category tag**: one of `Added`, `Changed`, `Fixed`, `Removed`, `Schema`. Use bold + period: `**Added.**`.

See [`docs/changelogs/README.md`](../../../../docs/changelogs/README.md) for the full convention.
