import { Effect, effectStack } from './Effect';

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
