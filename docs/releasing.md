# Releasing

`a8c-integration` publishes to npm as [`@automattic/a8c-integration`](https://www.npmjs.com/package/@automattic/a8c-integration). Releases are cut from `trunk` and **published by CI, not from a laptop** — the flow mirrors [Automattic/commands](https://github.com/Automattic/commands): bump the version on a release branch, merge it, then trigger the publish workflow, which uses npm **trusted publishing** (OIDC — no long-lived token).

## What ships

The `files` allowlist in `package.json` limits the published tarball to what a consumer needs:

- `bin/a8c-integration` — the launcher shim
- `dist/` — the compiled CLI
- `README.md` and `docs/`

Source (`src/`), tests, `scripts/`, and config are not published. `prepublishOnly` runs `clean` then `build`, so the tarball always has a fresh `dist/`. Preview exactly what would ship with `npm pack --dry-run`.

## One-time setup

Before the first release, a repo/npm admin needs to:

1. **Configure trusted publishing on npm.** On the package's npmjs.org settings, add a trusted publisher pointing at this repo and the `Publish npm package` workflow (`.github/workflows/npm-publish.yml`). This lets CI publish over OIDC with no `NPM_TOKEN` secret.
2. **Create the `npm-publish` GitHub Environment** on the repo (the workflow runs under it), and add any protection rules you want — e.g. required reviewers so a publish can't run unattended.

`publishConfig.access` is already `public` in `package.json`, so the scoped package publishes publicly without extra flags.

## Cut a release

1. From an up-to-date, clean `trunk`, prepare the version bump:

   ```bash
   git switch trunk && git pull --ff-only
   pnpm release:prepare patch    # or minor / major
   ```

   This bumps `package.json` on a new `release/vX.Y.Z` branch and commits it. It refuses to run if trunk is dirty, behind `origin/trunk`, or the release branch already exists.

2. Push the branch and open a PR into `trunk`:

   ```bash
   git push -u origin release/vX.Y.Z
   ```

3. Once the PR is reviewed and **merged into `trunk`**, trigger the release: **Actions → “Publish npm package” → Run workflow** (or `gh workflow run "Publish npm package"`).

   The workflow checks out `trunk`, installs, runs `check-types` + tests + build, verifies the version isn't already on npm and the `vX.Y.Z` GitHub release doesn't exist, previews the tarball, publishes to npm via trusted publishing, and creates a `vX.Y.Z` GitHub release with generated notes.

## Verify

```bash
npm view @automattic/a8c-integration version
npx @automattic/a8c-integration@latest --version
```

## Notes

- The publish is intentionally **manual (`workflow_dispatch`)**, so merging a version bump never auto-publishes — someone triggers it deliberately.
- No secrets are stored: trusted publishing mints a short-lived token per run via OIDC. Publishing needs npm ≥ 11.5.1, which the workflow installs.
- Versions are immutable on npm, so never reuse one — to recover from a failed publish, land a new bump and run the workflow again.
