import { Directive, DirectiveInfo, DirectiveUtils } from '../directives';
import { type ArbitraryData, addScopeToNode } from '@timberts/core/src';

export class Data extends Directive {
  static Name = 'data';
  async callback(
    el: Element,
    { expression }: DirectiveInfo,
    { evaluate, reactive }: DirectiveUtils,
  ) {
    console.log('x-data', expression);
    const value = await evaluate<ArbitraryData>(expression);
    console.log(value);
    addScopeToNode(el, reactive(value));
  }
}
