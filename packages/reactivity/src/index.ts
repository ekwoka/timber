import { Effect, effect, release, stop } from './Effect';
import type { ReactiveEffect } from './Effect';
import { Signal, untrack } from './Signal';
import { reactive, toRaw } from './reactive';

export {
  Signal,
  untrack,
  Effect,
  ReactiveEffect,
  effect,
  release,
  stop,
  reactive,
  toRaw,
};

declare global {
  interface ImportMeta {
    DEBUG: boolean;
  }
}
