import { Effect, effectStack } from './Effect';
import { nextTick } from './nextTick';
import { $EMPTY } from './reactive/symbols';

let nextId = 1;
export class Signal<T = unknown> {
  id: number;
  [Symbol.toStringTag] = 'Signal';
  value: T;
  dependents: Set<Effect> = new Set();
  constructor(value: T) {
    this.id = nextId++;
    this.value = value;
  }
  get() {
    if (dontTrack) return this.value;
    const activeEffect = effectStack.at(-1);
    if (activeEffect) {
      activeEffect.register(this);
      this.dependents.add(activeEffect);
    }
    return this.value;
  }
  set(value: T) {
    if (Object.is(value, this.value)) return;
    this.value = value;
    this.dependents.forEach((effect) => effect.rerun());
  }
  peek() {
    return this.value;
  }
  release(effect: Effect) {
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

export const computed = <T>(cb: () => T): Signal<T> => {
  const signal = new Signal<T>($EMPTY as T);
  new Effect(() => signal.set(cb()));
  return signal;
};

if (import.meta.vitest) {
  describe.concurrent('Signal', () => {
    it('wraps values with Signal', () => {
      const signal = new Signal(1);
      expect(signal.get()).toBe(1);
      signal.set(42);
      expect(signal.get()).toBe(42);
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
    it('knows it is a Signal', () =>
      expect(new Signal(1).toString()).toEqual('[object Signal]'));
  });
  describe.concurrent('computed Signal', () => {
    it('can derive a Signal from a function', () => {
      const computedSignal = computed(() => 1);
      expect(computedSignal.get()).toBe(1);
    });
    it('reruns when dependencies change', async () => {
      const first = new Signal(5);
      const second = new Signal(10);
      const computedSignal = computed(() => first.get() + second.get());
      expect(computedSignal.get()).toBe(15);
      first.set(42);
      await nextTick();
      expect(computedSignal.get()).toBe(52);
      second.set(100);
      await nextTick();
      expect(computedSignal.get()).toBe(142);
    });
  });
}
