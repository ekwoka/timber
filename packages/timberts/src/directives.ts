import { mergeReactiveStack } from '../../reactivity/src/reactive';
import Timber from './Timber';
import { parseAttributeName } from './parseAttributeName';
import type { ArbitraryData } from '@timberts/core';
import type { evaluateLater } from '@timberts/evaluator';
import { evaluate } from '@timberts/evaluator';
import { type effect } from '@timberts/reactivity';

const AttrDirectiveMap = new WeakMap<Attr, Directive>();

export class Directive {
  static Name = 'unknown';
  inline(_el: Element, _directive: DirectiveInfo, _utils: DirectiveUtils) {}
  callback(_el: Element, _directive: DirectiveInfo, _utils: DirectiveUtils) {}
  constructor(
    public el: Element,
    public directive: DirectiveInfo,
  ) {
    if (directive.attr) AttrDirectiveMap.set(directive.attr, this);
  }
  init(Timber: Timber) {
    const utils: DirectiveUtils = {
      Timber,
      effect: Timber.effect,
      cleanup: (callback: () => void) => this.cleanups.push(callback),
      evaluateLater: <T>(expression: string, extras?: ArbitraryData) => {
        const evaluate = Timber.evaluateLater<T>(
          expression,
          mergeReactiveStack([Timber.$data(this.el) ?? {}, extras ?? {}]),
        );
        return () => evaluate();
      },
      evaluate: <T>(expression: string, extras?: ArbitraryData) => {
        return Timber.evaluate<T>(
          expression,
          mergeReactiveStack([Timber.$data(this.el) ?? {}, extras ?? {}]),
        );
      },
    };
    this.inline?.(this.el, this.directive, utils);
    return this;
  }
  execute(Timber: Timber) {
    const utils: DirectiveUtils = {
      Timber,
      effect: (cb: () => void) => {
        const effect = Timber.effect(cb);
        this.cleanups.push(() => effect.release());
        return effect;
      },
      cleanup: (callback: () => void) => this.cleanups.push(callback),
      evaluateLater: <T>(expression: string, extras?: ArbitraryData) => {
        const evaluate = Timber.evaluateLater<T>(
          expression,
          mergeReactiveStack([Timber.$data(this.el) ?? {}, extras ?? {}]),
        );
        return () => evaluate();
      },
      evaluate: <T>(expression: string, extras?: ArbitraryData) => {
        return Timber.evaluate<T>(
          expression,
          mergeReactiveStack([Timber.$data(this.el) ?? {}, extras ?? {}]),
        );
      },
    };
    this.callback?.(this.el, this.directive, utils);
    return this;
  }
  cleanups: (() => void)[] = [];
  cleanup() {
    this.cleanups.forEach((clean) => clean());
  }

  static after = '';
  static from(pre: string, attr: Attr) {
    const el = attr.ownerElement;
    const parsed = Object.assign(parseAttributeName(pre, attr.name), {
      attr,
      expression: attr.value,
    }) as DirectiveInfo;
    if (!el) throw new Error('Attribute has no owner element');
    return new this(el, parsed);
  }
}

export type DirectiveCallback = (
  el: Element,
  directive: DirectiveInfo,
  utils: DirectiveUtils,
) => void | Promise<void>;

export type DirectiveUtils = {
  Timber: Timber;
  effect: typeof effect;
  cleanup: (callback: () => void) => void;
  evaluateLater: typeof evaluateLater;
  evaluate: typeof evaluate;
};

export type DirectiveInfo = {
  raw: string;
  directive: string;
  value: string;
  modifiers: string[];
  expression: string;
  attr: Attr;
};

export const makeDirective = (name: string, callback: DirectiveCallback) => {
  return class extends Directive {
    static override Name = name;
    override callback = callback;
  };
};
