/* Code Goes Here */

/**
 * Things to think about:
 * How to release effects so they don't run anymore?
 * What if there is a signal with MANY MANY effects listening to it?
 *  Can we avoid processing all those effects at the queue?
 *  Have signal "forget" effect until effect runs again?
 *
 * What if effect branches?
 *  if (sig.get()) textContent = OTHER.get()
 */

/* Effects depend on Signals */

/* Effects are dependents of Signals */
import { nextTick } from './nextTick';

// 1. Make a signal
class Signal<T> {
  value: T;
  dependencies: Effect[] = [];
  constructor(val: T) {
    this.value = val;
  }
  get() {
    /* is there an effect running? */
    const activeEffect = activeEffects.at(-1);
    if (activeEffect) {
      /* store what effect is running for later */
      this.dependencies.push(activeEffect);
    }

    return this.value;
  }
  set(val: T) {
    /* How do we run dependencts? */
    /* Are there dependents? */
    this.value = val;

    queueEffects(this.dependencies);
  }
}

// 3. Define active effect array

const activeEffects: Effect[] = [
  /* () => value = sig.get() */
];

const effectsToRun: Set<Effect> = new Set(); // ONLY UNIQUE EFFECTS [1, 1, 2]
let waitingToProcess = false;

const queueEffects = (effs: Effect[]) => {
  // add the effects to the queue of effects to run later
  // 1: () => textContent = sig.get() + otherSig.get()
  // 2: () => value = sig.get()

  // otherSig.set(42) // adds [1]
  // sig.set(3) // adds [1, 2]

  /* [
    () => textContent = sig.get() + otherSig.get(),
    () => textContent = sig.get() + otherSig.get(),
    () => value = sig.get()
  ] */

  effs.forEach((dep) => effectsToRun.add(dep));

  // Thank you so much. I really appreciate it :)

  // are we waiting for the queue to process?
  // if waiting do nothing

  if (waitingToProcess) return;

  waitingToProcess = true;
  // if not waiting
  // make a task to process the queue
  // runs task LATER

  // some effect a () => value = sig.get()
  // some effect b -> changes something to make effect a run again () => sig.set(3)
  // some effect a (DOESNT HAPPEN YET)
  queueMicrotask(() => {
    effectsToRun.forEach((dep) => {
      dep.func();
      effectsToRun.delete(dep);
    });
    waitingToProcess = false;
  });
};

// 2. We make an effect

class Effect {
  func: () => void;
  constructor(func: () => void) {
    this.func = func;
    activeEffects.push(this);
    func();
    activeEffects.pop();
  }
}

if (import.meta.vitest) {
  describe('reactivity', () => {
    it('stores a value', () => {
      const sig = new Signal(1);
      expect(sig.get()).toEqual(1);
      sig.set(2);
      expect(sig.get()).toEqual(2);
    });
    it('runs effect on signal change', async () => {
      const sig = new Signal(1);
      let value;
      new Effect(() => (value = sig.get()));
      expect(value).toEqual(1);
      sig.set(2);
      await nextTick();
      expect(value).toEqual(2);
      sig.set(42);
      await nextTick();
      expect(value).toEqual(42);
    });
    it('it only runs effect once when multiple values are set synchronously', async () => {
      const sig = new Signal(42);
      let value;
      const fn = vi.fn(() => (value = sig.get()));
      new Effect(fn);

      expect(value).toEqual(42);
      expect(fn).toBeCalledTimes(1);

      sig.set(69);
      // stuff happens
      sig.set(420);

      await nextTick();
      expect(value).toEqual(420);
      expect(fn).toBeCalledTimes(2);
      sig.set(0);
      await nextTick();
      expect(value).toEqual(0);
    });
  });
}
