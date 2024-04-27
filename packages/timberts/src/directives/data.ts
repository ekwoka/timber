import { type DirectiveCallback } from '../directives';
import { type ArbitraryData, addScopeToNode } from '@timberts/core';

export const Data: DirectiveCallback = async (
  el,
  { expression },
  { evaluate, Timber },
) => {
  console.log('x-data', expression);
  const value = await evaluate<ArbitraryData>(expression);
  console.log(value);
  addScopeToNode(el, Timber.reactive(value));
};
