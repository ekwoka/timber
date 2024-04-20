import { ArbitraryData, addScopeToNode } from '@timberts/core/src';
import { evaluate } from '@timberts/evaluator/src';
import { reactive } from '@timberts/reactivity/src';

export const data = async (el: HTMLElement) => {
  const expression = el.getAttribute('x-data');
  console.log('x-data', expression);
  const value = await evaluate<ArbitraryData>(expression);
  console.log(value);
  addScopeToNode(el, reactive(value));
};
