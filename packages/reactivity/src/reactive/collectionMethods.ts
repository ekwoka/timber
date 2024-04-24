import { Signal } from '../Signal';
import {
  type MapTypes,
  type SetTypes,
  hasOwn,
  isMapType,
  isObject,
} from '../utils';
import { proxyMap } from './proxyMap';
import { reactive, toRaw, wrap } from './reactive';
import { reactiveNodes } from './reactiveNodes';
import { $EMPTY, $PROXY, $RAW, $SIZE } from './symbols';

export const collectionTraps: ProxyHandler<MapTypes | SetTypes> = {
  get(target, p, receiever) {
    if (p === $RAW) return target;
    if (p === $PROXY) return proxyMap.get(target);
    const methodHandlers = isMapType(target) ? mapMethods : setMethods;
    return Reflect.get(
      hasOwn(methodHandlers, p) && p in target ? methodHandlers : target,
      p,
      receiever,
    );
  },
};

function add(this: SetTypes, value: unknown) {
  const target = toRaw(this);
  const rawValue = toRaw(value);
  const nodes = reactiveNodes.get(target)!;
  if (nodes.has(rawValue)) {
    nodes.get(rawValue)!.set(reactive(rawValue));
  } else {
    const signal = wrap(value);
    nodes.set(rawValue, signal);
  }
  target.add(value as object);
  nodes.get($SIZE)?.set(Reflect.get(target, 'size', target));
  return this;
}

function get(this: MapTypes, key: unknown) {
  const target = toRaw(this);
  const rawKey = toRaw(key);
  const nodes = reactiveNodes.get(target)!;
  const rawValue = target.get(rawKey as object);
  if (nodes.has(rawKey)) return nodes.get(rawKey)!.get();
  const signal = wrap(rawValue);
  nodes.set(rawKey, signal);
  return signal.get();
}

function set<T extends MapTypes>(this: T, ...kv: [unknown, unknown]) {
  const target = toRaw(this);
  const [rawKey, rawValue] = kv.map(toRaw);
  const nodes = reactiveNodes.get(target)!;
  if (nodes.has(rawKey)) {
    const signal = nodes.get(rawKey)!;
    if (!Object.is(toRaw(signal.peek()), rawValue))
      signal.set(reactive(rawValue));
  } else {
    const signal = wrap(rawValue);
    nodes.set(rawKey, signal);
  }
  target.set(rawKey as object, rawValue);
  nodes.get($SIZE)?.set(Reflect.get(target, 'size', target));
  return this;
}

function has(this: MapTypes, key: object) {
  const target = toRaw(this);
  const rawKey = toRaw(key);
  this.get(rawKey as object);
  return target.has(rawKey as object);
}

function setHas(this: SetTypes, value: object) {
  const target = toRaw(this);
  const rawValue = toRaw(value);
  const nodes = reactiveNodes.get(target)!;
  if (!nodes.has(rawValue)) nodes.set(rawValue, wrap($EMPTY));
  nodes.get(rawValue)?.get();
  return target.has(rawValue);
}

function destroy(this: MapTypes, key: unknown) {
  const target = toRaw(this);
  const rawKey = toRaw(key);
  const nodes = reactiveNodes.get(target)!;
  if (nodes.has(rawKey)) {
    nodes.get(rawKey)!.set($EMPTY);
    nodes.delete(rawKey);
  }
  const deleteResult = target.delete(rawKey as object);
  const innerSize = Reflect.get(target, 'size', target);
  nodes.get($SIZE)?.set(innerSize);
  return deleteResult;
}

function clear(this: Map<unknown, unknown>) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target)!;
  nodes.forEach((node) => node.set($EMPTY));
  nodes.clear();
  return target.clear();
}

function size(this: MapTypes | SetTypes) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target)!;
  const innerSize = Reflect.get(target, 'size', target);
  if (!nodes.has($SIZE)) {
    const signal = new Signal(innerSize);
    nodes.set($SIZE, signal);
  }
  const sizeSignal = nodes.get($SIZE)! as Signal<number>;
  sizeSignal.set(innerSize);
  return sizeSignal.get();
}

function forEach<T extends Map<unknown, unknown> | Set<unknown>>(
  this: T,
  cb: (v: unknown, k: unknown, map: T) => void,
  thisArg: T = this,
) {
  for (const entry of iterate.call(this)) {
    const [key, value] = Array.isArray(entry) ? entry : [entry];
    cb.call(thisArg, value ?? key, key, this);
  }
}

function iterate(this: Map<unknown, unknown> | Set<unknown>) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target);
  if (!nodes) return target[Symbol.iterator]();
  return isMapType(this)
    ? iterateReactiveMap(this)
    : iterateReactiveSet(this, IterKind.VALUES);
}

function keys(this: Map<unknown, unknown> | Set<unknown>) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target);
  if (!nodes) return target.keys();
  return isMapType(this)
    ? iterateReactiveMap(this, IterKind.KEYS)
    : iterateReactiveSet(this, IterKind.KEYS);
}

function values(this: Map<unknown, unknown> | Set<unknown>) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target);
  if (!nodes) return target.values();
  return isMapType(this)
    ? iterateReactiveMap(this, IterKind.VALUES)
    : iterateReactiveSet(this, IterKind.VALUES);
}

function entries(this: Map<unknown, unknown> | Set<unknown>) {
  const target = toRaw(this);
  const nodes = reactiveNodes.get(target);
  if (!nodes) return target.entries();
  return isMapType(this)
    ? iterateReactiveMap(this, IterKind.ENTRIES)
    : iterateReactiveSet(this, IterKind.ENTRIES);
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
  [Symbol.iterator]: iterate as () => IterableIterator<[unknown, unknown]>,
  keys,
  values,
  entries,
};

const setMethods: Partial<SetTypes> = {
  add,
  has: setHas,
  delete: destroy,
  clear,
  get size() {
    return size.call(this as Set<unknown>);
  },
  forEach,
  [Symbol.iterator]: iterate,
  keys,
  values,
  entries,
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
function iterateReactiveSet<K>(
  set: Set<K>,
  mode: IterKind.KEYS,
): IterableIterator<K>;
function iterateReactiveSet<K>(
  set: Set<K>,
  mode: IterKind.VALUES,
): IterableIterator<K>;
function iterateReactiveSet<K>(
  set: Set<K>,
  mode?: IterKind.ENTRIES,
): IterableIterator<[K, K]>;
function* iterateReactiveSet<K>(
  set: Set<K>,
  mode: IterKind | undefined,
): IterableIterator<[K, K] | K> {
  const target = toRaw(set);
  const nodes = reactiveNodes.get(target)!;
  set.size;
  for (const [rawKey] of target.entries()) {
    const reactiveKey =
      nodes.get(rawKey)?.get() ?? isObject(rawKey) ? reactive(rawKey) : rawKey;
    if (!mode || mode === IterKind.ENTRIES) yield [reactiveKey, reactiveKey];
    else yield reactiveKey;
  }
}
