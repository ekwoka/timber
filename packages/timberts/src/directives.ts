import Timber from '.';
import { evaluate } from '@timberts/evaluator/src';
import { reactive } from '@timberts/reactivity/src';

export class Directive {
  protected aft = '';
  private inCB: DirectiveCallback | null = null;
  constructor(private cb: DirectiveCallback) {}
  after(directive: string) {
    this.aft = directive;
    return this;
  }
  inline(cb: DirectiveCallback) {
    this.inCB = cb;
    return this;
  }
  init(el: HTMLElement, directive: DirectiveInfo, utils: DirectiveUtils) {
    if (this.inCB) this.inCB(el, directive, utils);
    return this;
  }
  execute(el: HTMLElement, directive: DirectiveInfo, utils: DirectiveUtils) {
    this.cb(el, directive, utils);
  }
}

export type DirectiveCallback = (
  el: HTMLElement,
  directive: DirectiveInfo,
  utils: DirectiveUtils,
) => void | Promise<void>;

export type DirectiveUtils = {
  evaluate: typeof evaluate;
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
