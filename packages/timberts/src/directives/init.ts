import type { DirectiveCallback } from '../directives';

export const Init: DirectiveCallback = (el, { expression }, { evaluate }) => {
  if (typeof expression === 'string') {
    !!expression.trim() && evaluate(expression, {});
    return;
  }

  evaluate(expression, {});
};
