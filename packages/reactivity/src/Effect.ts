import { Signal } from './Signal';

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
