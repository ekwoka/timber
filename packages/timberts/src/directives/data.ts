import { type DirectiveCallback } from '../directives';
import { type ArbitraryData, addScopeToNode } from '@timberts/core';

export const Data: DirectiveCallback = async (
  el,
  { expression },
  { evaluate, Timber },
) => {
  const value = await evaluate<ArbitraryData>(expression);
  addScopeToNode(el, Timber.reactive(value));
};
