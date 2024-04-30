import type { DirectiveCallback } from '../directives';

export const Effect: DirectiveCallback = (
  _,
  { expression },
  { effect, evaluateLater },
) => {
  effect(evaluateLater(expression));
};
