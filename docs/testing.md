# Testing

The suite is [Jest](https://jestjs.io/) with [ts-jest](https://kulshekhar.github.io/ts-jest/), so tests run straight against the TypeScript sources — no build step needed.

## Run the tests

```bash
pnpm test
```

Run a single file or match by name:

```bash
pnpm exec jest scaffold
pnpm exec jest -t "conformant"
```

## Before you push

```bash
pnpm lint && pnpm format:check && pnpm check-types && pnpm test
```
