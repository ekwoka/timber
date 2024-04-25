import { type DirectiveCallback } from '../directives';
import { nearestContext } from '@timberts/core';
import { effect } from '@timberts/reactivity';

export const Text: DirectiveCallback = (
  el,
  { expression },
  { evaluateLater },
) => {
  const root = nearestContext(el);
  console.log('x-text', expression);
  const evaluate = evaluateLater<string>(expression, root?.data);
  effect(async () => console.log((el.textContent = await evaluate())));
};
