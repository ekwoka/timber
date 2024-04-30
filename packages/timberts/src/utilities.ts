import type Timber from './Timber';
import type { evaluate, evaluateLater } from '@timberts/evaluator';
import type { effect } from '@timberts/reactivity';

export type Utilities = {
  Timber: Timber;
  effect: typeof effect;
  cleanup: (callback: () => void) => void;
  evaluateLater: <T>(expression: string) => ReturnType<typeof evaluateLater<T>>;
  evaluate: <T>(
    expression: string | (() => T),
    extras?: Record<string, unknown>,
    _?: boolean,
  ) => ReturnType<typeof evaluate<T>>;
};
