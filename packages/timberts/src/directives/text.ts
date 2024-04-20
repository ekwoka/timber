import { nearestContext } from '@timberts/core/src';
import { evaluateLater } from '@timberts/evaluator/src';
import { effect } from '@timberts/reactivity/src';

export const text = (el: HTMLElement) => {
  const root = nearestContext(el);
  const expression = el.getAttribute('x-text');
  console.log('x-text', expression);
  const evaluate = evaluateLater(expression, root.data);
  effect(async () => console.log((el.textContent = await evaluate())));
};
