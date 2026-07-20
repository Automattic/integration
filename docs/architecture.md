# Architecture

`a8c-integration` is a small TypeScript CLI. The design goal is that each piece is independently testable and free of framework glue, so the conformance logic and the scaffolding logic can be exercised without spawning the CLI.

## Layout

```
bin/a8c-integration        Launcher shim: requires dist/cli.js and calls run()
src/
  cli.ts                   Commander wiring: defines `init` and `validate`
  commands/
    init.ts                `init` — lay down the Starter Kit, rewrite, report
    validate.ts            `validate` — run the checker, print a report, set exit code
  lib/
    colors.ts              Tiny ANSI helper (chalk-shaped, dependency-free)
    validate/
      validate.ts          Nine conformance checks (pure, fs-only)
      report.ts            Human and JSON rendering of a report
    scaffold/
      scaffold.ts          The Starter Kit prefix rewrite (pure, fs-only)
__tests__/                 Jest tests for validate, report, and scaffold
```

## Command flow

**`init`** collects the vendor and integration names (flags or interactive prompt), and then prepares a boilerplate integration plugin from the `A8C_STARTER_KIT_SOURCE`.

**`validate [path]`** resolves the target directory, confirms it looks like an integration, runs `validateIntegration()`, prints the report (human or JSON), and sets `process.exitCode = 1` when the integration is not conformant.

## The conformance checker (`lib/validate`)

Checks if the integration meets the wpvip guidelines. All checks are **static** — they inspect files and config, never execute the integration. `validateIntegration(root)` builds a single `Context` (parsed `composer.json`, concatenated PHP/docs/workflow text, the detected config constant and entry file) and runs each rule against it, so the filesystem is read once. Rules return `pass` / `fail` / `warn` / `not_applicable`; only a `fail` breaks conformance. Two inherently non-static items (config-schema match, security review) are returned as human-review items.

## The scaffolder (`lib/scaffold`)

It derives a prefix set (pascal / kebab / snake / upper forms) from the vendor and integration names and rewrites the example tokens (`ExampleVendor`, `example-integration`, `VIP_EXAMPLE_INTEGRATION`, ...) across the tree. Replacement uses PHP `strtr` semantics — longest match wins and a replacement is never re-scanned.

## Dependencies

Runtime: [`commander`](https://github.com/tj/commander.js) for argument parsing. Colors are a ~15-line ANSI helper rather than a dependency, which keeps the build a plain CommonJS `tsc` compile with no ESM-only packages. Dev: `typescript`, `jest`, and `ts-jest` for the build and tests, plus `eslint` with [`@automattic/eslint-plugin-wpvip`](https://github.com/Automattic/eslint-plugin-wpvip) and `wp-prettier` for lint/format — the same tooling as [Automattic/commands](https://github.com/Automattic/commands). The package manager is **pnpm** (pinned via `packageManager`).
