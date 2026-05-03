import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../js/utils/events.js';

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

  describe('error isolation and iteration safety', () => {
    it('a throwing listener does not prevent subsequent listeners from running', () => {
      const ee = new EventEmitter();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const before = vi.fn();
      const boom = vi.fn(() => { throw new Error('listener boom'); });
      const after = vi.fn();
      ee.on('evt', before);
      ee.on('evt', boom);
      ee.on('evt', after);

      expect(() => ee.emit('evt', 1)).not.toThrow();
      expect(before).toHaveBeenCalledWith(1);
      expect(boom).toHaveBeenCalledWith(1);
      expect(after).toHaveBeenCalledWith(1);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('a listener removing another listener mid-emit does not skip the remaining', () => {
      const ee = new EventEmitter();
      const c = vi.fn();
      const b = vi.fn();
      const a = vi.fn(() => ee.off('evt', b));
      ee.on('evt', a);
      ee.on('evt', b);
      ee.on('evt', c);

      ee.emit('evt');
      // 'a' runs, removes 'b'. With snapshot iteration, 'b' still runs this turn,
      // and 'c' definitely runs (regression guard against Set mutation skipping).
      expect(a).toHaveBeenCalledOnce();
      expect(c).toHaveBeenCalledOnce();
    });

    it('a listener adding a new listener mid-emit does not call the new one this turn', () => {
      const ee = new EventEmitter();
      const newOne = vi.fn();
      const adder = vi.fn(() => ee.on('evt', newOne));
      ee.on('evt', adder);

      ee.emit('evt');
      expect(adder).toHaveBeenCalledOnce();
      expect(newOne).not.toHaveBeenCalled();

      ee.emit('evt');
      expect(newOne).toHaveBeenCalledOnce();
    });
  });
});
