import { Directive, type DirectiveCallback, makeDirective } from './directives';
import { parseAttributeName } from './parseAttributeName';
import { nearestContext } from '@timberts/core';
import type { ArbitraryData } from '@timberts/core';
import { evaluateLater } from '@timberts/evaluator';
import { evaluate } from '@timberts/evaluator';
import type { Effect } from '@timberts/reactivity';
import { effect, reactive } from '@timberts/reactivity';
import { getRootElements, walk } from '@timberts/walker';

export { Data, Text, On } from './directives/index';

export class Timber {
  private pre = 'x-';
  private directives = new Map<string, typeof Directive>();
  /**
   * Create a Timber Instance
   * @param {HTMLElement} treeRoot to initialize Timber on
   */
  constructor(private treeRoot: HTMLElement = document.body) {}
  /**
   * Start Timber
   * @returns {Timber} Timber Instance
   */
  start(): this {
    console.log(this.directives.entries());
    initTree(this.treeRoot, async (el) => {
      console.log(el);
      const directives = el
        .getAttributeNames()
        .map(parseAttributeName(this.pre))
        .filter(({ directive }) => this.directives.has(directive))
        .map((directive) => {
          const attr = el.getAttributeNode(directive.raw);
          if (!attr) throw new Error('Attribute not found');
          directive.expression = attr.value;
          return this.directives
            .get(directive.directive)!
            .from(directive, attr);
        });
      await Promise.all(directives.map((attr) => attr.execute(this)));
    });
    return this;
  }
  /**
   * Set a custom prefix
   * @param {string} pre prefix @default 'x-'
   * @returns {Timber} Timber Instance
   */
  prefix(pre: string): this {
    this.pre = pre;
    return this;
  }
  /**
   * Register a custom directive
   * @param {string} name directive name
   * @param {Directive} directive directive function
   * @returns {Timber} Timber Instance
   */
  directive(name: string, directive: DirectiveCallback): this;
  /**
   * Register a custom directive
   * @param {Directive} directive directive function
   * @returns {Timber} Timber Instance
   */
  directive(directive: typeof Directive): this;
  directive(
    nameOrDir: string | typeof Directive,
    directive?: DirectiveCallback,
  ): this {
    if (typeof nameOrDir === 'string')
      nameOrDir = makeDirective(nameOrDir, directive!);
    this.directives.set(nameOrDir.Name, nameOrDir);
    return this;
  }

  reactive<T>(value: T): T {
    return reactive(value);
  }
  effect(callback: () => void): Effect {
    return effect(callback);
  }
  evaluate<T>(
    expression: string,
    extras?: Record<string, unknown>,
  ): Promise<T> {
    return evaluate<T>(expression, extras);
  }
  evaluateLater<T>(
    expression: string,
    extras?: Record<string, unknown>,
  ): () => Promise<T> {
    return evaluateLater<T>(expression, extras);
  }
  $data(el: Element): ArbitraryData | null {
    return nearestContext(el)?.data ?? null;
  }
}

const initTree = async (
  el: HTMLElement,
  cb: (el: HTMLElement) => Promise<void> | void,
) => {
  const roots = getRootElements(el);
  console.log(roots);
  await Promise.all(Array.prototype.map.call(roots, walk(cb)));
};

export default Timber;
