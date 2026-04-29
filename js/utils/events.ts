// @ts-nocheck
/**
 * Lightweight EventEmitter for inter-module communication.
 */
export class EventEmitter {
  constructor() {
    this._e = {};
  }

  on(evt, fn) {
    (this._e[evt] ??= new Set()).add(fn);
    return () => this.off(evt, fn);
  }

  off(evt, fn) {
    this._e[evt]?.delete(fn);
  }

  emit(evt, ...args) {
    this._e[evt]?.forEach(fn => fn(...args));
  }
}
