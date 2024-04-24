import Timber from '.';
import type { evaluateLater } from '@timberts/evaluator/src';
import { evaluate } from '@timberts/evaluator/src';
import { reactive } from '@timberts/reactivity/src';

export class Directive {
  static Name = 'unknown';
  inline(_el: Element, _directive: DirectiveInfo, _utils: DirectiveUtils) {}
  callback(_el: Element, _directive: DirectiveInfo, _utils: DirectiveUtils) {}
  constructor(
    public el: Element,
    public directive: DirectiveInfo,
  ) {}
  init(utils: DirectiveUtils) {
    this.inline?.(this.el, this.directive, utils);
    return this;
  }
  execute(utils: DirectiveUtils) {
    this.callback?.(this.el, this.directive, utils);
    return this;
  }

  static after = '';
  static from(directive: DirectiveInfo, attr: Attr) {
    const el = attr.ownerElement;
    if (!el) throw new Error('Attribute has no owner element');
    return new this(el, directive);
  }
}

export type DirectiveCallback = (
  el: Element,
  directive: DirectiveInfo,
  utils: DirectiveUtils,
) => void | Promise<void>;

export type DirectiveUtils = {
  evaluate: typeof evaluate;
  evaluateLater: typeof evaluateLater;
  reactive: typeof reactive;
  timber: Timber;
};

export type DirectiveInfo = {
  raw: string;
  directive: string;
  value?: string;
  modifiers: string[];
  expression: string;
};

export const makeDirective = (name: string, callback: DirectiveCallback) => {
  return class extends Directive {
    static override Name = name;
    override callback = callback;
  };
};
