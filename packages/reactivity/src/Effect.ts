import type { Signal } from './Signal';

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
