import { Effect } from '../Effect';
import { Signal, untrack } from '../Signal';
import { nextTick } from '../nextTick';
import { MapTypes, SetTypes, hasOwn, isMapType, isSetType } from '../utils';
import { proxyMap } from './proxyMap';
import { reactive, toRaw, wrap } from './reactive';
import { reactiveNodes } from './reactiveNodes';
import { $PROXY, $RAW } from './symbols';

export const makeMapReactive = <T extends MapTypes>(obj: T): T => {
  reactiveNodes.set(
    obj,
    obj instanceof Map
      ? new Map()
      : (new WeakMap() as Map<unknown, Signal<unknown>>),
  );
  const wrapped = new Proxy(obj, collectionTraps);
  proxyMap.set(obj, wrapped);
  return wrapped as T;
};

export const makeSetReactive = <T extends SetTypes>(obj: T): T => {
  reactiveNodes.set(
    obj,
    obj instanceof Set
      ? new Map()
      : (new WeakMap() as Map<unknown, Signal<unknown>>),
  );
  const wrapped = new Proxy(obj, collectionTraps);
  proxyMap.set(obj, wrapped);
  return wrapped as T;
};

const collectionTraps: ProxyHandler<MapTypes | SetTypes> = {
  get(target, p, receiever) {
    if (p === $RAW) return target;
    if (p === $PROXY) return proxyMap.get(target);
    if (p === 'add') console.log('add', target instanceof Set);
    const methodHandlers = isMapType(target) ? mapMethods : setMethods;
    return Reflect.get(
      hasOwn(methodHandlers, p) && p in target ? methodHandlers : target,
      p,
      receiever,
    );
  },
};

const $SIZE = Symbol('$SIZE');

function add(this: SetTypes, value: unknown) {
  const target = toRaw(this);
  const rawValue = toRaw(value);
  const nodes = reactiveNodes.get(target);
  if (nodes && !nodes.has(rawValue)) {
    const signal = wrap(value);
    nodes.set(rawValue, signal);
  }
  target.add(value as object);
  nodes?.get($SIZE)?.set(Reflect.get(target, 'size', target));
  return this;
}

function get(this: MapTypes, key: unknown) {
  const target = toRaw(this);
  const rawKey = toRaw(key);
  const nodes = reactiveNodes.get(target);
  const rawValue = target.get(rawKey as object);
  if (!nodes) return rawValue;
  if (nodes.has(rawKey)) return nodes.get(rawKey)!.get();
  const signal = wrap(rawValue);
  nodes.set(rawKey, signal);
  return signal.get();
}

function set<T extends MapTypes>(this: T, ...kv: [unknown, unknown]) {
  const target = toRaw(this);
  const [rawKey, rawValue] = kv.map(toRaw);
  const nodes = reactiveNodes.get(target);
  if (nodes) {
    if (nodes.has(rawKey)) {
      const signal = nodes.get(rawKey)!;
      if (!untrack(() => Object.is(toRaw(signal.get()), rawValue)))
        signal.set(reactive(rawValue));
    } else {
      const signal = wrap(rawValue);
      nodes.set(rawKey, signal);
    }
  }
  target.set(rawKey as object, rawValue);
  nodes?.get($SIZE)?.set(Reflect.get(target, 'size', target));
  return this;
}

function has(this: MapTypes, key: unknown) {
  const target = toRaw(this);
  const rawKey = toRaw(key);
  this.get(rawKey as object);
  return target.has(rawKey as object);
}

function destroy(this: MapTypes, key: unknown) {
  const target = toRaw(this);
  const rawKey = toRaw(key);
  const nodes = reactiveNodes.get(target);
  if (!nodes) return target.delete(rawKey as object);
  if (nodes.has(rawKey)) {
    nodes.get(rawKey)?.set(undefined);
    nodes.delete(rawKey);
  }
  const deleteResult = target.delete(rawKey as object);
  const innerSize = Reflect.get(target, 'size', target);
  nodes.get($SIZE)?.set(innerSize);
  return deleteResult;
}

function clear(this: Map<unknown, unknown>) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target);
  if (nodes) {
    nodes.forEach((node) => node.set(undefined));
    nodes.clear();
  }
  return target.clear();
}

function size(this: MapTypes) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target);
  const innerSize = Reflect.get(target, 'size', target);
  if (!nodes) return innerSize;
  if (!nodes.has($SIZE)) {
    const signal = new Signal(innerSize);
    nodes.set($SIZE, signal);
  }
  const sizeSignal = nodes.get($SIZE)!;
  sizeSignal.set(innerSize);
  return sizeSignal.get();
}

function forEach(
  this: Map<unknown, unknown>,
  cb: (v: unknown, k: unknown, map: Map<unknown, unknown>) => void,
  thisArg: Map<unknown, unknown>,
) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target);
  if (!nodes)
    if (isSetType(target)) return target.forEach(cb, thisArg);
    else return target.forEach(cb, thisArg);
  this.size;
  return target.forEach((_rawValue, rawKey) => {
    cb.call(thisArg, this.get(rawKey), reactive(rawKey), this);
  });
}

function iterateMap(this: Map<unknown, unknown>) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target);
  if (!nodes) return target[Symbol.iterator]();
  return iterateReactiveMap(this);
}

function keys(this: Map<unknown, unknown>) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target);
  if (!nodes) return target.keys();
  return iterateReactiveMap(this, IterKind.KEYS);
}

function values(this: Map<unknown, unknown>) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target);
  if (!nodes) return target.values();
  return iterateReactiveMap(this, IterKind.VALUES);
}

function entries(this: Map<unknown, unknown>) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target);
  if (!nodes) return target.entries();
  return iterateReactiveMap(this, IterKind.ENTRIES);
}

const mapMethods: Partial<MapTypes> = {
  get,
  set,
  has,
  delete: destroy,
  clear,
  get size() {
    return size.call(this as Map<unknown, unknown>);
  },
  forEach,
  [Symbol.iterator]: iterateMap,
  keys,
  values,
  entries,
};

const setMethods: Partial<SetTypes> = {
  add,
};

const enum IterKind {
  KEYS = 1,
  VALUES = 2,
  ENTRIES = 4,
}

function iterateReactiveMap<K, V>(
  map: Map<K, V>,
  mode: IterKind.KEYS,
): IterableIterator<K>;
function iterateReactiveMap<K, V>(
  map: Map<K, V>,
  mode: IterKind.VALUES,
): IterableIterator<V>;
function iterateReactiveMap<K, V>(
  map: Map<K, V>,
  mode?: IterKind.ENTRIES,
): IterableIterator<[K, V]>;
function* iterateReactiveMap<K, V>(
  map: Map<K, V>,
  mode: IterKind | undefined,
): IterableIterator<[K, V] | K | V> {
  const target = toRaw(map);
  map.size;
  for (const [rawKey] of target.entries()) {
    if (mode === IterKind.KEYS) yield reactive(rawKey);
    else if (mode === IterKind.VALUES) yield map.get(rawKey)!;
    else yield [reactive(rawKey), map.get(rawKey)!];
  }
}

if (import.meta.vitest) {
  describe('(Weak)Map', () => {
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
    describe('.size', () => {
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
    describe('.forEach', () => {
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
    describe('iterators', () => {
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
  describe('(Weak)Set', () => {
    it('can handle Set', () => {
      const set = reactive(new Set());
      set.add(42);
      set.add(69);
      /* expect(set.has(42)).toBe(true);
      expect(set.has(69)).toBe(true);
      expect(set.has(420)).toBe(false);
      expect(set.size).toBe(2);
      set.delete(42);
      expect(set.has(42)).toBe(false);
      expect(set.has(69)).toBe(true);
      expect(set.size).toBe(1);
      set.clear();
      expect(set.has(69)).toBe(false);
      expect(set.size).toBe(0); */
    });
  });
}
