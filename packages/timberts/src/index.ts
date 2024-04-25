import { Directive, type DirectiveCallback, makeDirective } from './directives';
import { parseAttributeName } from './parseAttributeName';
import { evaluateLater } from '@timberts/evaluator';
import { evaluate } from '@timberts/evaluator';
import { reactive } from '@timberts/reactivity';
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
      await Promise.all(
        directives.map((attr) =>
          attr.execute({
            reactive: reactive,
            evaluate: evaluate,
            evaluateLater: evaluateLater,
            timber: this,
          }),
        ),
      );
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
