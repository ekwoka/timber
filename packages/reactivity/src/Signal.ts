import { Effect, effectStack } from './Effect';
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
