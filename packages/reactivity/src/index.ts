import { Effect, effect, release, stop } from './Effect';
import type { ReactiveEffect } from './Effect';
import { Signal, computed, untrack } from './Signal';
import { reactive, toRaw } from './reactive';

export {
  Signal,
  untrack,
  computed,
  Effect,
  type ReactiveEffect,
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
