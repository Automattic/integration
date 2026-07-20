# Setup

How to build and run `a8c-integration` from source.

## Prerequisites

- Node.js — the version is pinned in [`.nvmrc`](../.nvmrc) (currently 22). The package supports Node 20 or newer (`engines` in `package.json`).
- [pnpm](https://pnpm.io) — this repo uses pnpm, pinned via `packageManager` in `package.json`. With a recent Node, `corepack enable pnpm` installs the matching version.
- `git` on your `PATH` (`init` clones the Starter Kit with it)

## Install dependencies

```bash
git clone https://github.com/automattic/integration.git
cd integration
nvm use          # switches to the Node version in .nvmrc (nvm install if needed)
pnpm install
```

If you don't use [nvm](https://github.com/nvm-sh/nvm), just make sure your Node matches `.nvmrc` (or is at least the `engines` floor).

## Build

The CLI is written in TypeScript and compiles to `dist/` with `tsc`:

```bash
pnpm build
```

`bin/a8c-integration` is a thin launcher that requires the compiled `dist/cli.js`, so after a build you can run:

```bash
node bin/a8c-integration --help
```

To link it as a global `a8c-integration` command while developing:

```bash
pnpm build && pnpm link --global
a8c-integration --help
```

## Type-check, lint, and format

```bash
pnpm check-types     # tsc --noEmit
pnpm lint            # ESLint with the @automattic/eslint-plugin-wpvip config
pnpm format          # Prettier (wp-prettier) — write; `pnpm format:check` to verify only
```

## Try it end to end

`init` always builds from the canonical VIP Integrations Starter Kit, so a plain
run clones it from GitHub:

```bash
node bin/a8c-integration init --vendor "Acme" --name "Content Sync" --dir /tmp/content-sync
node bin/a8c-integration validate /tmp/content-sync
```

### Offline / test override

The Starter Kit source is intentionally not a CLI option — a partner never picks
it. For local development and tests where you don't want a network fetch, point
`init` at a local Starter Kit clone with the `A8C_STARTER_KIT_SOURCE` environment
variable:

```bash
A8C_STARTER_KIT_SOURCE=/path/to/vip-integrations-starter-kit \
  node bin/a8c-integration init --vendor "Acme" --name "Content Sync" --dir /tmp/content-sync
```

This override is for development only; it is not part of the public interface.
