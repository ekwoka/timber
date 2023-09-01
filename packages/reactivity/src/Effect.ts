import { Signal } from './Signal';
import { nextTick } from './nextTick';

let nextId = 1 << 10;
const noop = () => {};
export class Effect {
  id: number;
  [Symbol.toStringTag] = 'Effect';
  operation: () => void;
  dependencies: Set<Signal> = new Set();
  constructor(cb: () => void) {
    this.id = nextId++;
    this.operation = cb;
    this.run();
  }
  run() {
    effectStack.push(this);
    this.operation();
    effectStack.pop();
  }
  register(signal: Signal) {
    this.dependencies.add(signal);
  }
  rerun() {
    if (this === effectStack.at(-1)) return;
    this.release();
    addToEffectQueue(this);
  }
  release(cleanUp?: boolean) {
    this.dependencies.forEach((signal) => {
      signal.release(this);
      this.dependencies.delete(signal);
    });
    if (cleanUp) this.operation = noop;
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
  effectQueue.push(effect);
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
  describe.concurrent('Effect', () => {
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
    it('knows it is an Effect', () =>
      expect(new Effect(() => {}).toString()).toBe('[object Effect]'));
  });
  describe.concurrent('release', () => {
    it('can release effects', async () => {
      const signal = new Signal(1);
      let value: number = 0;
      const effect = new Effect(() => (value = signal.get()));
      expect(value).toBe(1);
      signal.set(42);
      await nextTick();
      expect(value).toBe(42);
      release(effect);
      signal.set(100);
      await nextTick();
      expect(value).toBe(42);
    });
  });
}
