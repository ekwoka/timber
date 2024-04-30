import type { DirectiveCallback } from '../directives';

export const HTML: DirectiveCallback = (
  el,
  { expression },
  { effect, evaluateLater },
) => {
  const evaluate = evaluateLater<string>(expression);
  effect(async () => {
    const value = await evaluate();
    el.innerHTML = value;
  });
};
