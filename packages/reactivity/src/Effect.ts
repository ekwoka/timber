import { Signal } from './Signal';
import { nextTick } from './nextTick';

let nextId = 1 << 10;
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

export type ReactiveEffect = Effect;

export const effectStack: Effect[] = [];
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

export const effect = (cb: () => void) => new Effect(cb);
export const release = (effect: Effect) => effect.release(true);
export const stop = release;

if (import.meta.vitest) {
  describe('Effect', () => {
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
  });
}
