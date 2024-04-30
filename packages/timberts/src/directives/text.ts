import { type DirectiveCallback } from '../directives';
import { effect } from '@timberts/reactivity';

export const Text: DirectiveCallback = (
  el,
  { expression },
  { evaluateLater },
) => {
  const evaluate = evaluateLater<string>(expression);
  effect(async () => (el.textContent = await evaluate()));
};
