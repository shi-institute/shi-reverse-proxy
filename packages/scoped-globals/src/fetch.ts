import { AsyncLocalStorage } from 'node:async_hooks';

const fetchStorage = new AsyncLocalStorage<typeof fetch>();

/**
 * Provides a way to use a custom fetch implementation in a specific async context.
 *
 * This is useful in environments like Cloudflare Workers where the global fetch
 * implementation may not work correctly for making requests to the same worker.
 * By using a custom fetch implementation that implements env.SELF.fetch, you can
 * avoid 522 errors when making requests to the same worker from within the worker.
 *
 * Register the modified fetch implementation by calling `register()`. Then, use
 * `withFetch()` to specify a custom fetch implementation in a specific async context.
 * Any code that runs within the callback passed to `withFetch()` will use the provided
 * fetch implementation instead of the original fetch implementation.
 */
export class ScopedFetch {
  private _originalFetch: typeof fetch;

  constructor() {
    this._originalFetch = globalThis.__shi_scoped_globals__originalFetch ?? globalThis.fetch.bind(globalThis);

    // Preserve a reference to the original fetch implementation in case
    // it is needed later.
    if (!globalThis.__shi_scoped_globals__originalFetch) {
      globalThis.__shi_scoped_globals__originalFetch = this._originalFetch;
    }
  }

  private get scopedFetch() {
    return (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const scopedFetch = fetchStorage.getStore();
      if (scopedFetch) return scopedFetch(input, init);
      return this._originalFetch(input, init);
    };
  }

  /**
   * Replaces the global fetch with a modified version that checks
   * for whether a custom fetch implementation has been provided in the current
   * async context.
   *
   * Specify a custom fetch implementation in a specific async context by calling
   * `withFetch()`. Any code that runs within the callback passed to `withFetch()`
   * will use the provided fetch implementation instead if the original
   * fetch implementation.
   *
   * @returns The original fetch implementation before it was replaced.
   */
  dangerous__replaceFetch() {
    // Preserve a reference to the original fetch implementation in case
    // it is needed later.
    if (!globalThis.__shi_scoped_globals__originalFetch) {
      globalThis.__shi_scoped_globals__originalFetch = this._originalFetch;
    }

    // Replaces the original fetch with a modified version that uses
    // a provided fetch implementation, if available.
    globalThis.fetch = this.scopedFetch;

    return this._originalFetch;
  }

  /**
   * Any code that runs within the callback passed to this function will use the provided
   * fetch implementation instead of the original fetch implementation.
   *
   * When used in a Cloudflare Worker, this allows you to use a custom fetch
   * implementation that implements env.SELF.fetch to avoid 522 errors whe
   *  making fetch requests.
   */
  withFetch<T>(fetchImpl: typeof fetch, callback: () => T): T {
    return fetchStorage.run(fetchImpl, callback);
  }

  get originalFetch() {
    return this._originalFetch;
  }
}

export const originalFetch = new Proxy(
  {},
  {
    get(target, property, receiver) {
      if (property === 'current') {
        return new ScopedFetch().originalFetch;
      }
    },
  }
) as { current: typeof fetch };
