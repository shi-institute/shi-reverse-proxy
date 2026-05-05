# @shi-institute/custom-elements

Svelte-based custom elements used across Shi Institute web properties. Ships two build targets:

- **Browser** (`./dist/browser`) — bundled custom element definitions and styles, loaded client-side
- **Server** (`./dist/server`) — SSR rendering utilities for injecting custom element HTML server-side before the browser bundle loads

## Exports

| Export                                               | Use                               |
| ---------------------------------------------------- | --------------------------------- |
| `@shi-institute/custom-elements/custom-elements`     | Client-side custom element bundle |
| `@shi-institute/custom-elements/custom-elements.css` | Stylesheet for custom elements    |
| `@shi-institute/custom-elements/server`              | Server-side rendering helpers     |

## Build

```sh
pnpm build
```
