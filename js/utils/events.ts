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
    this._e[evt]?.forEach(fn => fn(...args));
  }
}
