type Listener = (...args: unknown[]) => void;

/**
 * Lightweight EventEmitter for inter-module communication.
 */
export class EventEmitter {
  private _e: Record<string, Set<Listener>> = {};

  on(evt: string, fn: Listener): () => void {
    (this._e[evt] ??= new Set()).add(fn);
    return () => this.off(evt, fn);
  }

  off(evt: string, fn: Listener): void {
    this._e[evt]?.delete(fn);
  }

  emit(evt: string, ...args: unknown[]): void {
    const listeners = this._e[evt];
    if (!listeners || listeners.size === 0) return;
    // Snapshot so a listener that adds/removes other listeners during emit
    // does not perturb the iteration.
    const snapshot = Array.from(listeners);
    for (const fn of snapshot) {
      try {
        fn(...args);
      } catch (err) {
        // Isolate listeners: a throwing one must not break the others.
        console.error(`[EventEmitter] listener for "${evt}" threw:`, err);
      }
    }
  }
}
