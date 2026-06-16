/**
 * Browser shim for `node:async_hooks`.
 *
 * `@tanstack/start-client-core` indirectly pulls in
 * `@tanstack/start-storage-context/dist/esm/async-local-storage.js`, which
 * imports `AsyncLocalStorage` from `node:async_hooks` at module scope. That
 * module is server-only; Vite externalizes it in the browser bundle and the
 * generated stub throws when constructed.
 *
 * The storage context is only meaningful for request-scoped server work. In
 * the browser, a minimal no-op implementation is enough to let the client
 * hydrate without tripping over the Node import.
 */
export class AsyncLocalStorage<T> {
  private store: T | undefined;

  run<R>(store: T, callback: () => R): R {
    this.store = store;
    try {
      return callback();
    } finally {
      this.store = undefined;
    }
  }

  getStore(): T | undefined {
    return this.store;
  }

  enterWith(store: T): void {
    this.store = store;
  }
}

export default { AsyncLocalStorage };
