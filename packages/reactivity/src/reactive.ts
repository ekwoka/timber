import { Signal, untrack } from './Signal';

export const $PROXY = Symbol('$PROXY');
export const $RAW = Symbol('$RAW');
const proxyMap = new WeakMap<object, object>();
const reactiveNodes = new WeakMap<object, { [key: string | symbol]: Signal }>();
// eslint-disable-next-line @typescript-eslint/ban-types
const wrappableObjects: (Function | undefined)[] = [Array, Object, undefined];
const isWrappable = (obj: object) => wrappableObjects.includes(obj.constructor);

export const reactive = <T extends object>(obj: T): T => {
  if (typeof obj !== 'object' || obj === null || !isWrappable(obj)) return obj;
  if (proxyMap.has(obj)) return proxyMap.get(obj) as T;
  if ($RAW in obj) return obj;
  reactiveNodes.set(obj, Object.create(null));
  const wrapped = new Proxy(obj, {
    has(target, p) {
      if (p === $RAW) return true;
      if (p === $PROXY) return true;
      return Reflect.has(target, p);
    },
    get(target, p: string | symbol, reciever) {
      if (p === $RAW) return target;
      if (p === $PROXY) return proxyMap.get(target);
      if (!(p in target)) return undefined;
      if (!Object.hasOwnProperty.call(target, p)) return Reflect.get(target, p);
      const descriptor = Object.getOwnPropertyDescriptor(target, p);
      if (descriptor?.get) return descriptor.get.call(reciever);
      const nodes = reactiveNodes.get(target);
      if (!nodes) return undefined;
      if (p in nodes) return nodes[p].get();
      const signal = wrap(Reflect.get(target, p));
      nodes[p] = signal;
      return signal.get();
    },
    set(target, p: string | symbol, newValue, reciever) {
      if (import.meta.DEBUG)
        console.log(
          'setting',
          p,
          'to',
          newValue,
          Reflect.get(target, p) === newValue ? 'SAME' : 'DIFFERENT',
        );
      const nodes = reactiveNodes.get(target);
      if (!nodes) return false;
      const descriptor = Object.getOwnPropertyDescriptor(target, p);
      if (descriptor?.set) {
        descriptor.set.call(reciever, newValue);
        return true;
      }
      if (p in nodes) {
        if (untrack(() => nodes[p].get()) === newValue) return true;
        nodes[p].set(
          typeof newValue === 'object' ? reactive(newValue) : newValue,
        );
      } else {
        const signal = wrap(Reflect.get(target, p));
        nodes[p] = signal;
        signal.set(
          typeof newValue === 'object' ? reactive(newValue) : newValue,
        );
      }
      Reflect.set(target, p, newValue);
      return true;
    },
  });
  Object.defineProperty(obj, $PROXY, {
    enumerable: false,
    configurable: false,
    value: wrapped,
  });
  proxyMap.set(obj, wrapped);

  return wrapped as T;
};

const wrap = <T>(item: T): Signal<T> => {
  if (item instanceof Signal) return item;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof item === 'object' && item !== null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Signal(reactive(item as any));
  return new Signal(item);
};

export const toRaw = <T extends object>(obj: T): T => Reflect.get(obj, $RAW);
