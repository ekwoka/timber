import { Directive, DirectiveCallback } from '../directives';
import { ArbitraryData, addScopeToNode } from '@timberts/core/src';

export const datacb: DirectiveCallback = async (
  el: HTMLElement,
  { expression },
  { evaluate, reactive },
) => {
  console.log('x-data', expression);
  const value = await evaluate<ArbitraryData>(expression);
  console.log(value);
  addScopeToNode(el, reactive(value));
};

export const data = new Directive(datacb);
