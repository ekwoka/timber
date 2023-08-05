import { Signal, untrack } from '../Signal';
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
    if (nodes.has(rawKey)) {
      const node = nodes.get(rawKey)!;
      if (!untrack(() => Object.is(toRaw(node.get()), rawValue)))
        node.set(isObject(rawValue) ? reactive(rawValue) : rawValue);
      target.set(rawKey as object, rawValue);
      return this;
    }
    const signal = wrap(rawValue);
    nodes.set(rawKey, signal);
    target.set(
      rawKey as object,
      untrack(() => signal.get()),
    );
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
    return Reflect.get(target, 'size', target);
  },
};
