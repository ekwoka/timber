import { Directive, DirectiveCallback } from '../directives';
import { nearestContext } from '@timberts/core/src';

export const oncb: DirectiveCallback = (
  el: HTMLElement,
  { value, expression },
  { evaluate },
) => {
  const root = nearestContext(el);
  el.addEventListener(value ?? 'load', () => {
    evaluate(expression, root?.data);
  });
};

export const on = new Directive(oncb);
