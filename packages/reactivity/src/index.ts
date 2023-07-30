import { nextTick } from './nextTick';

declare global {
  interface ImportMeta {
    DEBUG: boolean;
  }
}

let nextId = 1;
export class Signal<T = unknown> {
  id: number;
  value: T;
  dependents: Set<Effect> = new Set();
  constructor(value: T) {
    this.id = nextId++;
    import.meta.DEBUG &&
      console.log(
        'creating Signal:',
        typeof value === 'object' ? 'object' : value,
        this.id,
      );
    this.value = value;
  }
  get() {
    import.meta.DEBUG &&
      console.log(
        'getting Signal:',
        typeof this.value === 'object' ? 'object' : this.value,
        this.id,
      );
    if (dontTrack) return this.value;
    const activeEffect = effectStack.at(-1);
    if (activeEffect) {
      import.meta.DEBUG &&
        console.log(
          'registering signal:',
          this.id,
          ', to effect:',
          activeEffect.id,
        );
      activeEffect.register(this);
      this.dependents.add(activeEffect);
    }
    return this.value;
  }
  set(value: T) {
    import.meta.DEBUG && console.log('setting signal:', value, this.id);
    this.value = value;
    this.dependents.forEach((effect) => effect.rerun());
  }
  release(effect: Effect) {
    import.meta.DEBUG &&
      console.log('releasing effect:', effect.id, ', from signal:', this.id);
    this.dependents.delete(effect);
  }
}

let dontTrack = false;
export const untrack = <T>(cb: () => T): T => {
  dontTrack = true;
  const output = cb();
  dontTrack = false;
  return output;
};
const effectStack: Effect[] = [];
const effectQueue: Effect[] = [];
let waitingForEffects = false;
const addToEffectQueue = (effect: Effect) => {
  const position = effectQueue.findIndex((e) => e.id > effect.id);
  if (position > -1) effectQueue.splice(position, 0, effect);
  else effectQueue.push(effect);
  if (waitingForEffects) return;
  waitingForEffects = true;
  queueMicrotask(processEffects);
};

const processEffects = () => {
  while (effectQueue.length) effectQueue.shift()?.run();
  waitingForEffects = false;
};

export class Effect {
  id: number;
  operation: () => void;
  dependencies: Set<Signal> = new Set();
  constructor(cb: () => void) {
    this.id = nextId++;
    import.meta.DEBUG && console.log('creating effect:', this.id);
    this.operation = cb;
    this.run();
  }
  run() {
    effectStack.push(this);
    import.meta.DEBUG && console.log('running effect:', this.id);
    this.operation();
    effectStack.pop();
  }
  register(signal: Signal) {
    import.meta.DEBUG &&
      console.log(
        'registering signal:',
        signal.id,
        ', to this effect:',
        this.id,
      );
    this.dependencies.add(signal);
  }
  rerun() {
    import.meta.DEBUG && console.log('triggering rerun on effect:', this.id);
    if (this === effectStack.at(-1)) return;
    this.release();
    addToEffectQueue(this);
  }
  release(cleanUp?: boolean) {
    import.meta.DEBUG && console.log('releasing effect', this.id);
    this.dependencies.forEach((signal) => {
      signal.release(this);
      this.dependencies.delete(signal);
    });
    if (cleanUp) this.operation = () => {};
  }
  dequeue() {
    const idx = effectQueue.indexOf(this);
    if (idx > -1) effectQueue.splice(idx, 1);
  }
}

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

// exports @vue/reactivity API
export const effect = (cb: () => void) => new Effect(cb);
export const release = (effect: Effect) => effect.release(true);
export const stop = release;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toRaw = <T extends object>(obj: T): T => Reflect.get(obj, $RAW);
export type ReactiveEffect = Effect;

const wrap = <T>(item: T): Signal<T> => {
  if (item instanceof Signal) return item;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof item === 'object' && item !== null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Signal(reactive(item as any));
  return new Signal(item);
};

if (import.meta.vitest) {
  describe('reactivity', () => {
    it('creates signals wrapping values', () => {
      const signal = new Signal(1);
      expect(signal.get()).toBe(1);
      signal.set(42);
      expect(signal.get()).toBe(42);
    });
    it('can register reactive effects', async () => {
      const signal = new Signal(1);
      let value: number = 0;
      new Effect(() => (value = signal.get()));
      expect(value).toBe(1);
      signal.set(42);
      expect(value).toBe(1);
      await nextTick();
      expect(value).toBe(42);
    });
    it('disconnects all signals tracking when effect is triggered', async () => {
      const first = new Signal(5);
      const second = new Signal(10);
      let value: number = 0;
      const effect = new Effect(() => (value = first.get() + second.get()));
      expect(value).toBe(15);
      expect(first.dependents.size).toBe(1);
      expect(second.dependents.size).toBe(1);
      expect(effect.dependencies.size).toBe(2);
      first.set(42);
      expect(first.dependents.size).toBe(0);
      expect(second.dependents.size).toBe(0);
      expect(effect.dependencies.size).toBe(0);
      await nextTick();
      expect(value).toBe(52);
      expect(first.dependents.size).toBe(1);
      expect(second.dependents.size).toBe(1);
      expect(effect.dependencies.size).toBe(2);
    });
    it('can release effects', async () => {
      const signal = new Signal(1);
      let value: number = 0;
      const effect = new Effect(() => (value = signal.get()));
      expect(value).toBe(1);
      signal.set(42);
      await nextTick();
      expect(value).toBe(42);
      effect.release();
      signal.set(100);
      await nextTick();
      expect(value).toBe(42);
    });
    it('can run released effects', async () => {
      const signal = new Signal(1);
      let value: number = 0;
      const effect = new Effect(() => (value = signal.get()));
      expect(value).toBe(1);
      signal.set(42);
      await nextTick();
      expect(value).toBe(42);
      effect.release();
      signal.set(100);
      await nextTick();
      expect(value).toBe(42);
      effect.run();
      expect(value).toBe(100);
    });
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
