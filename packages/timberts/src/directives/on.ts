import { type DirectiveCallback } from '../directives';
import { nearestContext } from '@timberts/core';

export const On: DirectiveCallback = (
  el,
  { value, expression },
  { evaluateLater },
) => {
  const root = nearestContext(el);
  const evaluate = evaluateLater(expression, root?.data);
  el.addEventListener(value ?? 'load', () => {
    evaluate();
  });
};
