import { nextTick } from './nextTick';

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
export const untrack = (cb: () => void) => {
  dontTrack = true;
  cb();
  dontTrack = false;
};
const effectStack: Effect[] = [];
const effectQueue: Effect[] = [];
let waitingForEffects = false;
const addToEffectQueue = (effect: Effect) => {
  effectQueue.push(effect);
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
    this.release();
    addToEffectQueue(this);
  }
  release() {
    import.meta.DEBUG && console.log('releasing effect', this.id);
    this.dependencies.forEach((signal) => {
      signal.release(this);
      this.dependencies.delete(signal);
    });
  }
}

const $PROXY = Symbol();
const $RAW = Symbol();
const reactiveNodes = new WeakMap<object, Record<string, Signal>>();
export const reactive = <T extends Record<string | number | symbol, unknown>>(
  obj: T,
): T => {
  if ($PROXY in obj) return obj[$PROXY] as T;
  reactiveNodes.set(obj, Object.create(null));
  const wrapped = new Proxy(obj, {
    get(target, p: keyof T) {
      if (p === $RAW) return target;
      if (!(p in target)) return undefined;
      const nodes = reactiveNodes.get(target) as { [key in keyof T]: Signal };
      if (!nodes) return undefined;
      if (p in nodes) return nodes[p].get();
      const signal = wrap(target[p]);
      nodes[p] = signal;
      return signal.get();
    },
    set(target, p: keyof T, newValue) {
      const nodes = reactiveNodes.get(target) as { [key in keyof T]: Signal };
      if (!nodes) return false;
      if (p in nodes) {
        nodes[p].set(
          typeof newValue === 'object' ? reactive(newValue) : newValue,
        );
        return true;
      }
      const signal = wrap(target[p]);
      nodes[p] = signal;
      signal.set(newValue);
      target[p] = newValue;
      return true;
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wrapped[$RAW as any as keyof T] = obj as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj[$PROXY as any as keyof T] = wrapped as any;

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
  });
}
