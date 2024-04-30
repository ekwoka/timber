import { Directive, type DirectiveCallback, makeDirective } from './directives';
import { type AttributeTransformer, mapAttributes } from './mapAttributes';
import { nearestContext } from '@timberts/core';
import type { ArbitraryData } from '@timberts/core';
import { evaluateLater } from '@timberts/evaluator';
import { evaluate } from '@timberts/evaluator';
import type { Effect } from '@timberts/reactivity';
import { effect, reactive } from '@timberts/reactivity';
import { getRootElements, walk } from '@timberts/walker';

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
    const mapper = mapAttributes(this.attributeMaps);
    initTree(this.treeRoot, async (el) => {
      const directives = el
        .getAttributeNames()
        .map((attr) => [mapper(attr), attr])
        .filter(([attribute]) => attribute.startsWith(this.pre))
        .map(([attribute, raw]) => {
          const attr = el.getAttributeNode(raw);
          if (!attr) throw new Error('Attribute not found');
          const name = attribute.match(new RegExp(`^${this.pre}([^.:]+)`))?.[1];
          if (!name || !this.directives.has(name)) return;
          const directive = this.directives.get(name)!.from(this.pre, attr);
          directive.init(this);

          return directive;
        })
        .filter(Boolean) as Directive[];
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
  private attributeMaps: AttributeTransformer[] = [];
  mapAttributes(fn: AttributeTransformer): this {
    this.attributeMaps.push(fn);
    return this;
  }
}

const initTree = async (
  el: HTMLElement,
  cb: (el: HTMLElement) => Promise<void> | void,
) => {
  const roots = getRootElements(el);
  await Promise.all(Array.prototype.map.call(roots, walk(cb)));
};

export default Timber;
