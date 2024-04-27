import { type DirectiveCallback } from '../directives';
import { effect } from '@timberts/reactivity';

export const Text: DirectiveCallback = (
  el,
  { expression },
  { evaluateLater },
) => {
  console.log('x-text', expression);
  const evaluate = evaluateLater<string>(expression);
  effect(async () => console.log((el.textContent = await evaluate())));
};
