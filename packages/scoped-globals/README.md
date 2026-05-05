# @shi-institute/scoped-globals

Provides `AsyncLocalStorage`-backed overrides for globals (currently `fetch`) so that per-request behavior can be applied without mutating `globalThis`.

This is used by the reverse proxy worker to route same-origin requests through the `SELF` service binding instead of the network, avoiding loopback connection errors.

## Build

```sh
pnpm build
```
