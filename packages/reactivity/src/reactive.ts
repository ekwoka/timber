import { Effect } from './Effect';
import { Signal, untrack } from './Signal';
import { nextTick } from './nextTick';

const $PROXY = Symbol('$PROXY');
const $RAW = Symbol('$RAW');
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
    it('handled nested reactive objects', async () => {
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
    it('can untrack inside an effect', async () => {
      const first = new Signal(5);
      const second = new Signal(10);
      let value: number = 0;
      new Effect(() => {
        const initial = first.get();
        untrack(() => (value = initial + second.get()));
      });
      expect(value).toBe(15);
      first.set(42);
      await nextTick();
      expect(value).toBe(52);
      second.set(100);
      await nextTick();
      expect(value).toBe(52);
    });
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
    it('recursivley wraps nested reactive objects', () => {
      const obj = reactive({
        foo: {
          bar: 42,
        },
      });
      const proxy = obj.foo;
      expect(proxy).toBe(obj.foo);
      expect(proxy.bar).toBe(42);
      expect(proxy.bar).toBe(obj.foo.bar);
    });
    it('return self when object is already reactive', () => {
      const obj = reactive({
        foo: 42,
      });
      expect(reactive(obj)).toBe(obj);
    });
  });
}
