import { Effect } from '../Effect';
import { Signal, untrack } from '../Signal';
import { nextTick } from '../nextTick';
import { MapTypes, hasOwn, isObject } from '../utils';
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

const collectionTraps: ProxyHandler<MapTypes> = {
  get(target, p, receiever) {
    if (p === $RAW) return target;
    if (p === $PROXY) return proxyMap.get(target);
    return Reflect.get(
      hasOwn(collectionMethods, p) && p in target ? collectionMethods : target,
      p,
      receiever,
    );
  },
};

const $SIZE = Symbol('$SIZE');

const collectionMethods: Partial<
  Map<unknown, unknown> & WeakMap<object, unknown>
> = {
  get(this: MapTypes, key: unknown) {
    const target = toRaw(this);
    const rawKey = toRaw(key);
    const nodes = reactiveNodes.get(target);
    const rawValue = target.get(rawKey as object);
    if (!nodes) return rawValue;
    if (nodes.has(rawKey)) return nodes.get(rawKey)!.get();
    const signal = wrap(rawValue);
    nodes.set(rawKey, signal);
    return signal.get();
  },
  set<T extends MapTypes>(this: T, ...kv: [unknown, unknown]) {
    const target = toRaw(this);
    const [rawKey, rawValue] = kv.map(toRaw);
    const nodes = reactiveNodes.get(target);
    if (!nodes) {
      target.set(rawKey as object, rawValue);
      return this;
    }
    const sizeSignal = nodes.get($SIZE);
    if (nodes.has(rawKey)) {
      const signal = nodes.get(rawKey)!;
      if (!untrack(() => Object.is(toRaw(signal.get()), rawValue)))
        signal.set(isObject(rawValue) ? reactive(rawValue) : rawValue);
    } else {
      const signal = wrap(rawValue);
      nodes.set(rawKey, signal);
    }
    target.set(rawKey as object, rawValue);
    if (sizeSignal) sizeSignal.set(Reflect.get(target, 'size', target));
    return this;
  },
  has(this: MapTypes, key: unknown) {
    const target = toRaw(this);
    const rawKey = toRaw(key);
    return target.has(rawKey as object);
  },
  delete(this: MapTypes, key: unknown) {
    const target = toRaw(this);
    const rawKey = toRaw(key);
    const nodes = reactiveNodes.get(target);
    if (!nodes) return target.delete(rawKey as object);
    if (nodes.has(rawKey)) {
      nodes.get(rawKey)?.set(undefined);
      nodes.delete(rawKey);
      nodes.get($SIZE)?.set(Reflect.get(target, 'size', target));
    }
    return target.delete(rawKey as object);
  },
  clear(this: Map<unknown, unknown>) {
    const target = toRaw(this);
    const nodes = reactiveNodes.get(target);
    if (nodes) {
      nodes.forEach((node) => node.set(undefined));
      nodes.clear();
    }
    return target.clear();
  },
  get size() {
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
  },
};

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
    it('.size: can get the size', async () => {
      const map = reactive(new Map());
      const fn = vi.fn(() => (value = map.size));
      let value: number = 42;
      new Effect(fn);
      expect(value).toBe(0);
      expect(fn).toBeCalledTimes(1);
      map.set('foo', 42);
      await nextTick();
      expect(value).toBe(1);
      map.set('bar', 69);
      await nextTick();
      expect(map.size).toBe(2);
      expect(value).toBe(2);
      expect(fn).toBeCalledTimes(3);
      map.set('foo', 69);
      await nextTick();
      expect(fn).toBeCalledTimes(4);
      expect(value).toBe(2);
      map.delete('foo');
      await nextTick();
      expect(value).toBe(1);
      map.clear();
      await nextTick();
      expect(value).toBe(0);
    });
  });
}
