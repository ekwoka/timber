import { Directive, DirectiveInfo, DirectiveUtils } from '../directives';
import { nearestContext } from '@timberts/core/src';
import { effect } from '@timberts/reactivity/src';

export class Text extends Directive {
  static Name: string = 'text';
  callback(
    el: Element,
    { expression }: DirectiveInfo,
    { evaluate }: DirectiveUtils,
  ) {
    const root = nearestContext(el);
    console.log('x-text', expression);
    effect(async () =>
      console.log((el.textContent = await evaluate(expression, root?.data))),
    );
  }
}
