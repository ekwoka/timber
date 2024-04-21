import { Directive, DirectiveCallback } from '../directives';
import { nearestContext } from '@timberts/core/src';
import { effect } from '@timberts/reactivity/src';

export const textcb: DirectiveCallback = (
  el: HTMLElement,
  { expression },
  { evaluate },
) => {
  const root = nearestContext(el);
  console.log('x-text', expression);
  effect(async () =>
    console.log((el.textContent = await evaluate(expression, root?.data))),
  );
};

export const text = new Directive(textcb);
