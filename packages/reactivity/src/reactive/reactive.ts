import { Signal, computed } from '../Signal';
import {
  isGetter,
  isMapType,
  isObject,
  isSetType,
  isSetter,
  isWeakType,
} from '../utils';
import { collectionTraps } from './collectionMethods';
import { proxyMap } from './proxyMap';
import { reactiveNodes } from './reactiveNodes';
import { $CACHEGETTERS, $PROXY, $RAW } from './symbols';

export const reactive = <T>(obj: T): T => {
  const rawObj = toRaw(obj);
  if (!isObject(rawObj)) return rawObj;
  if (proxyMap.has(rawObj)) return proxyMap.get(rawObj) as T;
  reactiveNodes.set(
    rawObj,
    isWeakType(rawObj)
      ? (new WeakMap() as Map<unknown, Signal<unknown>>)
      : new Map(),
  );
  return makeReactive(
    rawObj,
    isMapType(rawObj) || isSetType(rawObj) ? collectionTraps : defaultTraps,
  );
};

const makeReactive = <T extends object>(
  obj: T,
  handlers: ProxyHandler<object>,
): T => {
  const wrapped = new Proxy(obj, handlers);
  proxyMap.set(obj, wrapped);
  return wrapped as T;
};

const defaultTraps = {
  has<T extends object>(target: T, p: string | symbol) {
    if (p === $RAW) return true;
    if (p === $PROXY) return true;
    return p in target;
  },
  get<T extends object>(target: T, p: string | symbol, receiver: T) {
    if (p === $RAW) return target;
    if (p === $PROXY) return proxyMap.get(target);
    if (!(p in target)) return undefined;

    if (!Object.hasOwnProperty.call(target, p))
      return Reflect.get(target, p, receiver);

    const nodes = reactiveNodes.get(target)!;

    if (isGetter(target, p)) return handleGetter(target, p, receiver, nodes);
    if (nodes.has(p)) return nodes.get(p)?.get();
    const signal = wrap(Reflect.get(target, p));
    nodes.set(p, signal);
    return signal.get();
  },
  set<T extends object>(
    target: T,
    p: string | symbol,
    newValue: unknown,
    receiver: T,
  ) {
    const nodes = reactiveNodes.get(target);
    if (!nodes) return false;

    if (isSetter(target, p)) return Reflect.set(target, p, newValue, receiver);

    if (nodes.has(p)) {
      if (nodes.get(p)?.peek() === newValue) return true;
      nodes.get(p)?.set(reactive(newValue));
    } else {
      const signal = wrap(Reflect.get(target, p) as unknown);
      nodes.set(p, signal);
      signal.set(reactive(newValue));
    }
    return Reflect.set(target, p, newValue);
  },
};

export const wrap = <T>(item: T): Signal<T> => {
  if (item instanceof Signal) return item;
  if (isObject(item)) return new Signal(reactive(item));
  return new Signal(item);
};

export const handleGetter = <T extends object>(
  target: T,
  p: string | symbol,
  receiver: T,
  nodes: Map<unknown, Signal<unknown>>,
) => {
  const toCache = Reflect.get(target, $CACHEGETTERS, receiver) as
    | boolean
    | (string | symbol)[];
  if (Array.isArray(toCache) ? !toCache.includes(p) : !toCache)
    return Reflect.get(target, p, receiver);
  return (
    nodes.has(p)
      ? nodes
      : nodes.set(
          p,
          computed(() => Reflect.get(target, p, receiver)),
        )
  )
    .get(p)!
    .get();
};

export const toRaw = <T>(obj: T): T =>
  isObject(obj) ? (Reflect.get(obj, $RAW) as T) ?? obj : obj;
