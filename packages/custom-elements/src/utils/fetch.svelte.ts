import { hydratable, untrack } from 'svelte';

export type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export type Init = FetchInit & {};

export class ReactiveFetch<T> {
  data = $state<T | null>(null);
  error = $state<Error | null>(null);
  loading = $state(false);

  private controller = new AbortController();

  fetch = async (input: FetchInput, init?: Init) => {
    if (this.loading) {
      this.controller.abort();
      this.controller = new AbortController();
    }

    this.loading = true;
    this.error = null;

    try {
      const response = await fetch(input, {
        ...init,
        signal: this.controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.data = (await response.json()) as T;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Fetch was aborted, likely due to a new fetch being initiated. We can ignore this error.
        return this;
      }

      this.error = err instanceof Error ? err : new Error(String(err));
    } finally {
      this.loading = false;
    }
    return this;
  };
}

export async function fetchWithHydration<T>(name: string, getInput: () => FetchInput, getInit?: () => Init) {
  const hydratableResultPromise = hydratable(name, async () => {
    const tmp = new ReactiveFetch<T>();
    await tmp.fetch(getInput(), getInit?.());
    return { data: tmp.data, error: tmp.error ? tmp.error.message : null };
  });

  const fetcher = new ReactiveFetch<T>();
  const result = await hydratableResultPromise;
  fetcher.data = result.data;
  if (result.error) {
    fetcher.error = new Error(result.error);
  }

  let firstRun = true;

  const cleanup = $effect.root(() => {
    $effect(() => {
      const input = getInput();
      const init = getInit?.();

      if (firstRun) {
        firstRun = false;
        return;
      }

      untrack(() => fetcher.fetch(input, init));
    });
  });

  Object.defineProperties(fetcher, {
    stopReacting: {
      value: cleanup,
      enumerable: false,
    },
  });
  return fetcher as ReactiveFetch<T> & { stopReacting: () => void };
}
