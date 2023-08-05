import { Effect } from '../Effect';
import { Signal, untrack } from '../Signal';
import { nextTick } from '../nextTick';
import { isGetter, isMapType, isObject, isSetter } from '../utils';
import { makeMapReactive } from './collectionMethods';
import { proxyMap } from './proxyMap';
import { reactiveNodes } from './reactiveNodes';
import { $PROXY, $RAW } from './symbols';

export const reactive = <T extends object>(obj: T): T => {
  const rawObj = toRaw(obj);
  if (!isObject(rawObj)) return rawObj;
  if (proxyMap.has(rawObj)) return proxyMap.get(rawObj) as T;
  if (isMapType(rawObj)) return makeMapReactive(rawObj);
  return makeDefaultReactive(rawObj);
};

const makeDefaultReactive = <T extends object>(obj: T): T => {
  reactiveNodes.set(obj, new Map<string | symbol, Signal<unknown>>());
  const wrapped = new Proxy(obj, defaultTraps);
  Object.defineProperty(obj, $PROXY, {
    enumerable: false,
    configurable: false,
    value: wrapped,
  });
  proxyMap.set(obj, wrapped);

  return wrapped as T;
};

const defaultTraps = {
  has<T extends object>(target: T, p: string | symbol) {
    if (p === $RAW) return true;
    if (p === $PROXY) return true;
    return Reflect.has(target, p);
  },
  get<T extends object>(target: T, p: string | symbol, reciever: T) {
    if (p === $RAW) return target;
    if (p === $PROXY) return proxyMap.get(target);
    if (!(p in target)) return undefined;

    if (!Object.hasOwnProperty.call(target, p))
      return Reflect.get(target, p, reciever);

    if (isGetter(target, p)) return Reflect.get(target, p, reciever);

    const nodes = reactiveNodes.get(target);
    if (!nodes) return undefined;
    if (nodes.has(p)) return nodes.get(p)?.get();
    const signal = wrap(Reflect.get(target, p));
    nodes.set(p, signal);
    return signal.get();
  },
  set<T extends object>(
    target: T,
    p: string | symbol,
    newValue: unknown,
    reciever: T,
  ) {
    const nodes = reactiveNodes.get(target);
    if (!nodes) return false;

    if (isSetter(target, p)) return Reflect.set(target, p, newValue, reciever);

    if (nodes.has(p)) {
      if (untrack(() => nodes.get(p)?.get()) === newValue) return true;
      nodes.get(p)?.set(isObject(newValue) ? reactive(newValue) : newValue);
    } else {
      const signal = wrap(Reflect.get(target, p));
      nodes.set(p, signal);
      signal.set(isObject(newValue) ? reactive(newValue) : newValue);
    }
    return Reflect.set(target, p, newValue);
  },
};

export const wrap = <T>(item: T): Signal<T> => {
  if (item instanceof Signal) return item;
  if (isObject(item)) return new Signal(reactive(item));
  return new Signal(item);
};

export const toRaw = <T>(obj: T): T =>
  isObject(obj) ? Reflect.get(obj, $RAW) ?? obj : obj;

if (import.meta.vitest) {
  describe('reactive', () => {
    it('can create reactive objects', async () => {
      const data = reactive({
        foo: 0b1,
        bar: 0b10,
      });
      let value: number = 0b0;
      new Effect(() => (value = data.foo + data.bar));
      expect(value).toBe(0b11);
      data.foo = 0b100;
      expect(value).toBe(0b11);
      await nextTick();
      expect(value).toBe(0b110);
    });
    it('allows accessing the $PROXY on the passed in object', () => {
      const obj = { value: 42 };
      const proxy = reactive(obj);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(obj[$PROXY]).toBe(proxy);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(proxy[$PROXY]).toBe(proxy);
    });
    it('allows accessing the raw object from the $RAW property', () => {
      const obj = { value: 42 };
      const proxy = reactive(obj);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(proxy[$RAW]).toBe(obj);
    });
    it('returns the same proxy when wrapping the same target', () => {
      const obj = { value: 42 };
      const proxy = reactive(obj);
      expect(reactive(obj)).toBe(proxy);
    });
    it('return self when object is already reactive', () => {
      const obj = reactive({
        foo: 42,
      });
      expect(reactive(obj)).toBe(obj);
    });
    describe('objects', () => {
      it('handles nested reactive objects', async () => {
        const info = reactive({
          names: {
            first: 'Foo',
            last: 'Bar',
          },
        });
        let value: string = '';
        new Effect(() => (value = `${info.names.first} ${info.names.last}`));
        expect(value).toBe('Foo Bar');
        info.names.first = 'Fizz';
        expect(value).toBe('Foo Bar');
        expect(`${info.names.first} ${info.names.last}`).toBe('Fizz Bar');
        info.names.last = 'Buzz';
        expect(value).toBe('Foo Bar');
        await nextTick();
        expect(value).toBe('Fizz Buzz');
        info.names = {
          first: 'Peter',
          last: 'Parker',
        };
        expect(value).toBe('Fizz Buzz');
        await nextTick();
        expect(value).toBe('Peter Parker');
        info.names.last = 'Porker';
        await nextTick();
        expect(value).toBe('Peter Porker');
      });
      it('can handle getters', async () => {
        const data = reactive({
          innerFoo: 42,
          get foo() {
            return this.innerFoo;
          },
        });
        let value = 0;
        new Effect(() => (value = data.foo));
        expect(value).toBe(42);
        data.innerFoo = 100;
        await nextTick();
        expect(value).toBe(100);
      });
      it('can handle setters', async () => {
        const data = reactive({
          innerFoo: 42,
          set foo(value: number) {
            this.innerFoo = value;
          },
        });
        let value = 0;
        new Effect(() => (value = data.innerFoo));
        expect(value).toBe(42);
        data.foo = 100;
        await nextTick();
        expect(value).toBe(100);
      });
      it('can handle getter/setter pairs', async () => {
        const data = reactive({
          innerFoo: 42,
          get foo() {
            return this.innerFoo;
          },
          set foo(value: number) {
            this.innerFoo = value;
          },
        });
        let value = 0;
        new Effect(() => (value = data.foo));
        expect(value).toBe(42);
        data.foo = 100;
        await nextTick();
        expect(value).toBe(100);
      });
    });
    describe('arrays', () => {
      it('can handle reactive arrays', async () => {
        const arr = reactive([0b1, 0b10, 0b100]);
        let value = 0b0;
        new Effect(() => {
          value = arr.reduce((a, b) => a + b, 0);
        });
        expect(value).toBe(0b111);
        arr.push(0b1000);
        await nextTick();
        expect(value).toBe(0b1111);
      });
      it('does not rerun effects on reassignment of same array', async () => {
        const data = reactive({
          items: [1, 2, 3],
        });
        let value = 0;
        const effect = vi.fn(
          () => (value = data.items.reduce((a, b) => a + b, 0)),
        );
        new Effect(effect);
        expect(value).toBe(6);
        expect(effect).toHaveBeenCalledTimes(1);
        const items = data.items;
        items.splice(1, 1);
        await nextTick();
        expect(value).toBe(4);
        expect(effect).toHaveBeenCalledTimes(2);
        data.items = items;
        await nextTick();
        expect(value).toBe(4);
        expect(effect).toHaveBeenCalledTimes(2);
        data.items = items.map((i) => i * 2);
        await nextTick();
        expect(value).toBe(8);
        expect(effect).toHaveBeenCalledTimes(3);
      });
      it('reacts to internal mutations', async () => {
        const data = reactive([1, 2, 3]);
        let first = 0;
        let second = 0;
        let third = 0;
        new Effect(() => ([first, second, third] = data));
        expect(first).toBe(1);
        expect(second).toBe(2);
        expect(third).toBe(3);
        data.sort((a, b) => b - a);
        await nextTick();
        expect(first).toBe(3);
        expect(second).toBe(2);
        expect(third).toBe(1);
      });
      it('reacts to array length mutation', async () => {
        const data = reactive([1, 2, 3]);
        let value = 0;
        new Effect(() => (value = data.reduce((a, b) => a + b, 0)));
        expect(value).toBe(6);
        data.length = 2;
        await nextTick();
        expect(value).toBe(3);
        data.push(4);
        await nextTick();
        expect(value).toBe(7);
        data.shift();
        await nextTick();
        expect(value).toBe(6);
      });
    });

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
    });
  });
}
