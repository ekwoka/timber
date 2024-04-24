import { Effect } from '../Effect';
import { nextTick } from '../nextTick';
import { reactive } from './reactive';

describe.concurrent('(Weak)Map', () => {
  it('can handle Map', async () => {
    const map = reactive(new Map());
    map.set('foo', 42);
    let value = 0;
    new Effect(() => {
      value = map.get('foo');
    });
    expect(value).toBe(42);
    map.set('foo', 100);
    expect(map.get('foo')).toBe(100);
    await nextTick();
    expect(value).toBe(100);
  });
  it('can handle nested objects inside Map with object keys', async () => {
    const map = reactive(new Map());
    const key = { foo: 'bar' };
    map.set(key, {
      bar: 42,
    });
    let value = 0;
    new Effect(() => {
      value = map.get(key).bar;
    });
    expect(value).toBe(42);
    map.get(key).bar = 100;
    expect(map.get(key).bar).toBe(100);
    await nextTick();
    expect(value).toBe(100);
  });
  it('can get keys before they are set', async () => {
    const map = reactive(new Map());
    const key = { foo: 'bar' };
    let value = 0;
    new Effect(() => {
      value = map.get(key)?.bar;
    });
    expect(value).toBe(undefined);
    map.set(key, {
      bar: 42,
    });
    await nextTick();
    expect(value).toBe(42);
    map.get(key).bar = 100;
    expect(map.get(key).bar).toBe(100);
    await nextTick();
    expect(value).toBe(100);
  });
  it('can safely use reactive objects as keys', () => {
    const map = reactive(new Map());
    const rawKey = { foo: 'bar' };
    const key = reactive(rawKey);
    map.set(key, 42);
    expect(map.get(key)).toBe(42);
    expect(map.get(rawKey)).toBe(42);
  });
  it('.has: can check if a key is present', () => {
    const map = reactive(new Map());
    const rawKey = { foo: 'bar' };
    const key = reactive(rawKey);
    expect(map.has(key)).toBe(false);
    map.set(key, 42);
    expect(map.has(rawKey)).toBe(true);
  });
  it('.has: is reactive', async () => {
    const map = reactive(new Map());
    const key = { foo: 'bar' };
    let has = false;
    new Effect(() => {
      has = map.has(key);
    });
    expect(has).toBe(false);
    map.set(key, 42);
    await nextTick();
    expect(has).toBe(true);
    map.delete(key);
    await nextTick();
    expect(has).toBe(false);
  });
  it('.delete: can delete a key', async () => {
    const map = reactive(new Map());
    let value = 0;
    const key = 'foo';
    new Effect(() => (value = map.get(key)));
    expect(value).toBe(undefined);
    map.set(key, 42);
    await nextTick();
    expect(map.get(key)).toBe(42);
    expect(map.has(key)).toBe(true);
    expect(value).toBe(42);
    map.delete(key);
    await nextTick();
    expect(map.has(key)).toBe(false);
    expect(map.get(key)).toBe(undefined);
    expect(value).toBe(undefined);
    map.set(key, 69);
    await nextTick();
    expect(map.get(key)).toBe(69);
    expect(map.has(key)).toBe(true);
    expect(value).toBe(69);
  });
  it('.clear: can clear all pairs', async () => {
    const map = reactive(new Map());
    const key1 = 'foo';
    const key2 = 'bar';
    let value = 0;
    new Effect(() => (value = map.get(key1) + map.get(key2)));
    map.set(key1, 42);
    map.set(key2, 69);
    await nextTick();
    expect(map.has(key1)).toBe(true);
    expect(map.has(key2)).toBe(true);
    expect(value).toBe(111);
    map.clear();
    await nextTick();
    expect(map.has(key1)).toBe(false);
    expect(map.has(key2)).toBe(false);
    expect(value).toBe(NaN);
    map.set(key1, 420);
    map.set(key2, 69);
    await nextTick();
    expect(map.has(key1)).toBe(true);
    expect(map.has(key2)).toBe(true);
    expect(value).toBe(489);
  });
  describe.concurrent('.size', () => {
    it('can get the size', () => {
      const map = reactive(new Map());
      expect(map.size).toBe(0);
      map.set('foo', 42);
      expect(map.size).toBe(1);
      map.set('bar', 69);
      expect(map.size).toBe(2);
    });
    it('reacts to added keys', async () => {
      const map = reactive(new Map());
      let size = 0;
      new Effect(() => (size = map.size));
      expect(size).toBe(0);
      map.set('foo', 42);
      await nextTick();
      expect(size).toBe(1);
      map.set('bar', 69);
      await nextTick();
      expect(size).toBe(2);
    });
    it('reacts to deleted keys', async () => {
      const map = reactive(new Map());
      map.set('foo', 42);
      map.set('bar', 69);
      let size = 0;
      new Effect(() => (size = map.size));
      expect(size).toBe(2);
      map.delete('foo');
      await nextTick();
      expect(size).toBe(1);
      map.delete('bar');
      await nextTick();
      expect(size).toBe(0);
    });
    it('reacts to cleared map', async () => {
      const map = reactive(new Map());
      map.set('foo', 42);
      map.set('bar', 69);
      let size = 0;
      new Effect(() => (size = map.size));
      expect(size).toBe(2);
      map.clear();
      await nextTick();
      expect(size).toBe(0);
    });
    it('does not trigger effect when set to old key', async () => {
      const map = reactive(new Map());
      let size = 0;
      map.set('foo', 42);
      const fn = vi.fn(() => (size = map.size));
      new Effect(fn);
      expect(size).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
      map.set('foo', 69);
      await nextTick();
      expect(size).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
  describe.concurrent('.forEach', () => {
    it('iterates over all pairs', () => {
      const map = reactive(new Map());
      map.set('foo', 42);
      map.set('bar', 69);
      let value = 0;
      map.forEach((v) => (value += v));
    });
    it('reacts to added keys', async () => {
      const map = reactive(new Map());
      let value = 0;
      map.set('foo', 42);
      map.set('bar', 69);
      new Effect(() => map.forEach((v) => (value += v)));
      expect(value).toBe(111);
      map.set('baz', 420);
      value = 0;
      await nextTick();
      expect(value).toBe(531);
    });
    it('reacts to removed keys', async () => {
      const map = reactive(new Map());
      let value = 0;
      map.set('foo', 42);
      map.set('bar', 69);
      map.set('baz', 420);
      new Effect(() => map.forEach((v) => (value += v)));
      expect(value).toBe(531);
      map.delete('bar');
      value = 0;
      await nextTick();
      expect(value).toBe(462);
    });
    it('reacts to cleared map', async () => {
      const map = reactive(new Map());
      let value = 0;
      map.set('foo', 42);
      map.set('bar', 69);
      map.set('baz', 420);
      new Effect(() => map.forEach((v) => (value += v)));
      expect(value).toBe(531);
      map.clear();
      value = 0;
      await nextTick();
      expect(value).toBe(0);
    });
    it('reacts to changed values', async () => {
      const map = reactive(new Map());
      let value = 0;
      map.set('foo', 42);
      map.set('bar', 69);
      map.set('baz', 420);
      new Effect(() => map.forEach((v) => (value += v)));
      expect(value).toBe(531);
      map.set('bar', 11);
      value = 0;
      await nextTick();
      expect(value).toBe(473);
    });
    it('reacts to nested value changes', async () => {
      const map = reactive(new Map<string, { bar: number }>());
      let value = 0;
      map.set('foo', { bar: 42 });
      map.set('baz', { bar: 69 });
      map.set('qux', { bar: 420 });
      new Effect(() => map.forEach((v) => (value += v.bar)));
      expect(value).toBe(531);
      map.get('foo')!.bar = 11;
      value = 0;
      await nextTick();
      expect(value).toBe(500);
    });
  });
  describe.concurrent('iterators', () => {
    it('@@iterator', () => {
      const map = reactive(new Map());
      map.set('foo', 42);
      map.set('bar', 69);
      const iterator = map[Symbol.iterator]();
      expect(iterator.next()).toEqual({ value: ['foo', 42], done: false });
      expect(iterator.next()).toEqual({ value: ['bar', 69], done: false });
      expect(iterator.next()).toEqual({ value: undefined, done: true });
    });
    it('keys()', () => {
      const map = reactive(new Map());
      map.set('foo', 42);
      map.set('bar', 69);
      const iterator = map.keys();
      expect(iterator.next()).toEqual({ value: 'foo', done: false });
      expect(iterator.next()).toEqual({ value: 'bar', done: false });
      expect(iterator.next()).toEqual({ value: undefined, done: true });
    });
    it('values()', () => {
      const map = reactive(new Map());
      map.set('foo', 42);
      map.set('bar', 69);
      const iterator = map.values();
      expect(iterator.next()).toEqual({ value: 42, done: false });
      expect(iterator.next()).toEqual({ value: 69, done: false });
      expect(iterator.next()).toEqual({ value: undefined, done: true });
    });
    it('entries()', () => {
      const map = reactive(new Map());
      map.set('foo', 42);
      map.set('bar', 69);
      const iterator = map.entries();
      expect(iterator.next()).toEqual({ value: ['foo', 42], done: false });
      expect(iterator.next()).toEqual({ value: ['bar', 69], done: false });
      expect(iterator.next()).toEqual({ value: undefined, done: true });
    });
    it('react to mutations', async () => {
      const map = reactive(new Map());
      let keys = '';
      let values = '';
      let entries = '';
      map.set('foo', 42);
      map.set('bar', 69);
      map.set('baz', 420);

      const keyFn = vi.fn(() => {
        keys = [...map.keys()].toString();
      });
      new Effect(keyFn);

      const valueFn = vi.fn(() => {
        values = [...map.values()].toString();
      });
      new Effect(valueFn);

      const entryFn = vi.fn(() => {
        entries = [...map.entries()].map(([k, v]) => `${k}:${v}`).toString();
      });
      new Effect(entryFn);
      expect(keys).toBe('foo,bar,baz');
      expect(values).toBe('42,69,420');
      expect(entries).toBe('foo:42,bar:69,baz:420');
      [keyFn, valueFn, entryFn].forEach((fn) =>
        expect(fn).toHaveBeenCalledTimes(1),
      );
      map.set('qux', 111);
      await nextTick();
      expect(keys).toBe('foo,bar,baz,qux');
      expect(values).toBe('42,69,420,111');
      expect(entries).toBe('foo:42,bar:69,baz:420,qux:111');
      [keyFn, valueFn, entryFn].forEach((fn) =>
        expect(fn).toHaveBeenCalledTimes(2),
      );
      map.delete('bar');
      await nextTick();
      expect(keys).toBe('foo,baz,qux');
      expect(values).toBe('42,420,111');
      expect(entries).toBe('foo:42,baz:420,qux:111');
      [keyFn, valueFn, entryFn].forEach((fn) =>
        expect(fn).toHaveBeenCalledTimes(3),
      );
      map.set('foo', 69);
      await nextTick();
      expect(keys).toBe('foo,baz,qux');
      expect(values).toBe('69,420,111');
      expect(entries).toBe('foo:69,baz:420,qux:111');
      expect(keyFn).toHaveBeenCalledTimes(3); // keys shouldn't react to value changes
      [valueFn, entryFn].forEach((fn) => expect(fn).toHaveBeenCalledTimes(4));
    });
  });
});
describe.concurrent('(Weak)Set', () => {
  it('can handle Set', () => {
    const set = reactive(new Set());
    set.add(42);
    set.add(69);
    expect(set.has(42)).toBe(true);
    expect(set.has(69)).toBe(true);
    expect(set.has(420)).toBe(false);
    expect(set.size).toBe(2);
    set.delete(42);
    expect(set.has(42)).toBe(false);
    expect(set.has(69)).toBe(true);
    expect(set.size).toBe(1);
    set.clear();
    expect(set.has(69)).toBe(false);
    expect(set.size).toBe(0);
  });
  it('can react to mutations', async () => {
    const set = reactive(new Set<number>());
    let value = 0;
    let keys = 0;
    set.add(1);
    set.add(2);
    new Effect(() => set.forEach((val) => (value += val)));
    new Effect(() => (keys = [...set.keys()].reduce((a, b) => a + b, 0)));
    expect(value).toBe(0b11);
    expect(keys).toBe(0b11);
    set.add(4);
    value = 0;
    await nextTick();
    expect(value).toBe(0b111);
    expect(keys).toBe(0b111);
    set.delete(2);
    value = 0;
    await nextTick();
    expect(value).toBe(0b101);
    expect(keys).toBe(0b101);
    set.clear();
    value = 0;
    await nextTick();
    expect(value).toBe(0);
    expect(keys).toBe(0);
  });
  describe.concurrent('iterators', () => {
    it('@@iterator', () => {
      const map = reactive(new Set<number | string>());
      map.add('foo');
      map.add(69);
      const iterator = map[Symbol.iterator]();
      expect(iterator.next()).toEqual({ value: 'foo', done: false });
      expect(iterator.next()).toEqual({ value: 69, done: false });
      expect(iterator.next()).toEqual({ value: undefined, done: true });
    });
    it('keys()', () => {
      const map = reactive(new Set());
      map.add('foo');
      map.add(69);
      const iterator = map.keys();
      expect(iterator.next()).toEqual({ value: 'foo', done: false });
      expect(iterator.next()).toEqual({ value: 69, done: false });
      expect(iterator.next()).toEqual({ value: undefined, done: true });
    });
    it('values()', () => {
      const map = reactive(new Set());
      map.add('foo');
      map.add(69);
      const iterator = map.values();
      expect(iterator.next()).toEqual({ value: 'foo', done: false });
      expect(iterator.next()).toEqual({ value: 69, done: false });
      expect(iterator.next()).toEqual({ value: undefined, done: true });
    });
    it('entries()', () => {
      const map = reactive(new Set());
      map.add('foo');
      map.add(69);
      const iterator = map.entries();
      expect(iterator.next()).toEqual({ value: ['foo', 'foo'], done: false });
      expect(iterator.next()).toEqual({ value: [69, 69], done: false });
      expect(iterator.next()).toEqual({ value: undefined, done: true });
    });
    it('react to mutations', async () => {
      const map = reactive(new Set());
      let keys = '';
      let values = '';
      let entries = '';
      map.add('foo');
      map.add('bar');
      map.add('baz');

      const keyFn = vi.fn(() => {
        keys = [...map.keys()].toString();
      });
      new Effect(keyFn);

      const valueFn = vi.fn(() => {
        values = [...map.values()].toString();
      });
      new Effect(valueFn);

      const entryFn = vi.fn(() => {
        entries = [...map.entries()].map(([k, v]) => `${k}:${v}`).toString();
      });
      new Effect(entryFn);
      expect(keys).toBe('foo,bar,baz');
      expect(values).toBe('foo,bar,baz');
      expect(entries).toBe('foo:foo,bar:bar,baz:baz');
      [keyFn, valueFn, entryFn].forEach((fn) =>
        expect(fn).toHaveBeenCalledTimes(1),
      );
      map.add('qux');
      await nextTick();
      expect(keys).toBe('foo,bar,baz,qux');
      expect(values).toBe('foo,bar,baz,qux');
      expect(entries).toBe('foo:foo,bar:bar,baz:baz,qux:qux');
      [keyFn, valueFn, entryFn].forEach((fn) =>
        expect(fn).toHaveBeenCalledTimes(2),
      );
      map.delete('bar');
      await nextTick();
      expect(keys).toBe('foo,baz,qux');
      expect(values).toBe('foo,baz,qux');
      expect(entries).toBe('foo:foo,baz:baz,qux:qux');
      [keyFn, valueFn, entryFn].forEach((fn) =>
        expect(fn).toHaveBeenCalledTimes(3),
      );
      map.add('foo');
      await nextTick();
      expect(keys).toBe('foo,baz,qux');
      expect(values).toBe('foo,baz,qux');
      expect(entries).toBe('foo:foo,baz:baz,qux:qux');
      [keyFn, valueFn, entryFn].forEach((fn) =>
        expect(fn).toHaveBeenCalledTimes(3),
      );
    });
  });
});
