import { Directive, DirectiveInfo, DirectiveUtils } from '../directives';
import { nearestContext } from '@timberts/core/src';

export class On extends Directive {
  static Name = 'on';
  callback(
    el: Element,
    { value, expression }: DirectiveInfo,
    { evaluate }: DirectiveUtils,
  ) {
    const root = nearestContext(el);
    el.addEventListener(value ?? 'load', () => {
      evaluate(expression, root?.data);
    });
  }
}
