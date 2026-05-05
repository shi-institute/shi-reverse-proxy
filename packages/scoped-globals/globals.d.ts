export {};

declare global {
  /**
   * A reference to the original fetch implementation, preserved in case it is needed later.
   *
   * This is populated by `ScopedFetch`.
   */
  var __shi_scoped_globals__originalFetch: typeof fetch | undefined;
}
