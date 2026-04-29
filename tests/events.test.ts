import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../js/utils/events.ts';

describe('EventEmitter', () => {
  it('calls listener on emit', () => {
    const ee = new EventEmitter();
    const spy = vi.fn();
    ee.on('test', spy);
    ee.emit('test', 42);
    expect(spy).toHaveBeenCalledWith(42);
  });

  it('passes multiple arguments', () => {
    const ee = new EventEmitter();
    const spy = vi.fn();
    ee.on('evt', spy);
    ee.emit('evt', 'a', 'b', 'c');
    expect(spy).toHaveBeenCalledWith('a', 'b', 'c');
  });

  it('supports multiple listeners on same event', () => {
    const ee = new EventEmitter();
    const spy1 = vi.fn(), spy2 = vi.fn();
    ee.on('evt', spy1);
    ee.on('evt', spy2);
    ee.emit('evt');
    expect(spy1).toHaveBeenCalledOnce();
    expect(spy2).toHaveBeenCalledOnce();
  });

  it('does not call listeners for different events', () => {
    const ee = new EventEmitter();
    const spy = vi.fn();
    ee.on('a', spy);
    ee.emit('b');
    expect(spy).not.toHaveBeenCalled();
  });

  it('removes listener with off', () => {
    const ee = new EventEmitter();
    const spy = vi.fn();
    ee.on('evt', spy);
    ee.off('evt', spy);
    ee.emit('evt');
    expect(spy).not.toHaveBeenCalled();
  });

  it('on() returns an unsubscribe function', () => {
    const ee = new EventEmitter();
    const spy = vi.fn();
    const unsub = ee.on('evt', spy);
    unsub();
    ee.emit('evt');
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not throw when emitting with no listeners', () => {
    const ee = new EventEmitter();
    expect(() => ee.emit('nope')).not.toThrow();
  });

  it('does not throw when removing non-existent listener', () => {
    const ee = new EventEmitter();
    expect(() => ee.off('nope', () => {})).not.toThrow();
  });

  it('does not affect other listeners when one is removed', () => {
    const ee = new EventEmitter();
    const spy1 = vi.fn(), spy2 = vi.fn();
    ee.on('evt', spy1);
    ee.on('evt', spy2);
    ee.off('evt', spy1);
    ee.emit('evt');
    expect(spy1).not.toHaveBeenCalled();
    expect(spy2).toHaveBeenCalledOnce();
  });
});
