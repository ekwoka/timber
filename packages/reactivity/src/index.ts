import { nextTick } from './nextTick';

let nextId = 1;

export class Signal<T = unknown> {
  id: number;
  value: T;
  dependents: Set<Effect> = new Set();
  constructor(value: T) {
    this.id = nextId++;
    console.log(
      'creating Signal:',
      typeof value === 'object' ? 'object' : value,
      this.id,
    );
    this.value = value;
  }
  get() {
    console.log(
      'getting Signal:',
      typeof this.value === 'object' ? 'object' : this.value,
      this.id,
    );
    if (dontTrack) return this.value;
    const activeEffect = effectStack.at(-1);
    if (activeEffect) {
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
    console.log('setting signal:', value, this.id);
    this.value = value;
    this.dependents.forEach((effect) => effect.rerun());
  }
  release(effect: Effect) {
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
    console.log('creating effect:', this.id);
    this.operation = cb;
    this.run();
  }
  run() {
    effectStack.push(this);
    console.log('running effect:', this.id);
    this.operation();
    effectStack.pop();
  }
  register(signal: Signal) {
    console.log('registering signal:', signal.id, ', to this effect:', this.id);
    this.dependencies.add(signal);
  }
  rerun() {
    console.log('triggering rerun on effect:', this.id);
    this.release();
    addToEffectQueue(this);
  }
  release() {
    console.log('releasing effect', this.id);
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
    it('has reactivity', async () => {
      const info = reactive({
        names: {
          first: 'Foo',
          last: 'Bar',
        },
      });
      let value: string = '';
      const effect = new Effect(
        () => (value = `${info.names.first} ${info.names.last}`),
      );
      expect(value).toBe('Foo Bar');
      info.names.first = 'Fizz';
      expect(value).toBe('Foo Bar');
      expect(`${info.names.first} ${info.names.last}`).toBe('Fizz Bar');
      info.names.last = 'Buzz';
      expect(value).toBe('Foo Bar');
      await nextTick();
      expect(value).toBe('Fizz Buzz');
      effect.release();

      info.names.first = 'Tony';
      info.names.last = 'Stark';
      expect(value).toBe('Fizz Buzz');

      effect.run();
      expect(value).toBe('Tony Stark');

      info.names = {
        first: 'Peter',
        last: 'Parker',
      };

      expect(value).toBe('Tony Stark');

      await nextTick();
      expect(value).toBe('Peter Parker');
      info.names.last = 'Porker';
      await nextTick();
      expect(value).toBe('Peter Porker');
    });
  });
}
