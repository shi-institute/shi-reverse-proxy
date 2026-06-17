# @shi-institute/reverse-proxy

Cloudflare Worker that serves `shi.institute` for the Shi Institute for Sustainable Communities. It reverse-proxies content from several upstream origins, applies URL rewrites and redirects, injects shared UI (navigation, footer, custom elements), server-renders matching custom elements, and caches responses in Cloudflare KV and the edge cache.

## How it works

Each incoming request is matched against a queue of `ReverseProxy` handlers. The first handler whose path pattern matches processes the request: it fetches from the configured upstream origin, rewrites URLs in the response body to point back to `shi.institute`, and server-renders matching custom elements (e.g. `<shi-select>`).

Configured proxies:

| Proxy            | Upstream                              |
| ---------------- | ------------------------------------- |
| `furmanEdu`      | `www.furman.edu`                      |
| `blogsFurmanEdu` | `blogs.furman.edu`                    |
| `sli`            | SLI origin                            |
| `interactiveWeb` | ineractive-web origin                 |
| `upstateScLulc`  | Upstate SC land use/land cover origin |
| `customElements` | Serves built custom element assets    |

A scheduled cron handler re-caches pages and posts from `furmanEdu` and `blogsFurmanEdu` every 4 hours and refreshes recently modified posts every minute.

## Development

```sh
pnpm dev
```

Starts a local Vite dev server at `http://localhost:5173`.

## Deploy

```sh
pnpm deploy
```

Builds with Vite then deploys to Cloudflare Workers (production environment).

## Environment

| Variable                 | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `ORIGIN`                 | Canonical origin (e.g. `https://shi.institute`)             |
| `CLOUDFLARE_ZONE_ID`     | Zone used for cache purging                                 |
| `REVERSE_PROXY_KV_CACHE` | KV namespace binding for response cache                     |
| `SELF`                   | Service binding to this worker (avoids 522 loopback errors) |
