# Shi Institute Web Core

Monorepo for the Shi Institute for Sustainable Communities' web infrastructure. Built with pnpm workspaces and Turborepo.

## Structure

```
apps/
  reverse-proxy/        Cloudflare Worker serving shi.institute
packages/
  custom-elements/      Svelte-based custom elements (browser + server)
  schemas/              Shared Zod schemas
  scoped-globals/       AsyncLocalStorage-scoped global overrides (e.g. fetch)
  utils/                Shared utility functions
  vite-plugin-custom-elements-manifest/  Vite plugin for custom elements manifest generation
```

## Setup

Requires [pnpm](https://pnpm.io/).

```sh
pnpm install
```

## Scripts

| Command       | Description                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `pnpm dev`    | Starts the reverse proxy dev server and watches for changes to dependencies |
| `pnpm build`  | Builds all packages and the worker                                          |
| `pnpm deploy` | Builds and deploys the worker to Cloudflare                                 |
| `pnpm format` | Formats all files with Prettier                                             |
