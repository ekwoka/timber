import { nearestContext } from '@timberts/core/src';
import { evaluate } from '@timberts/evaluator/src';

export const click = (el: HTMLElement) => {
  const root = nearestContext(el);
  const expression = el.getAttribute('@click');
  console.log('@click', expression);
  el.addEventListener('click', () => {
    evaluate(expression, root.data);
  });
};
