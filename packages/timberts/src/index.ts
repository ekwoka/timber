import { Directive, DirectiveInfo } from './directives';
import { evaluate } from '@timberts/evaluator/src';
import { reactive } from '@timberts/reactivity/src';
import { getRootElements, walk } from '@timberts/walker/src';

export { data, text, on } from './directives/index';

export class Timber {
  private pre = 'x-';
  private directives = new Map<string, Directive>();
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
    initTree(this.treeRoot, async (el) => {
      console.log(el);
      const attrs = el
        .getAttributeNames()
        .map(parseAttributeName(this.pre))
        .filter(({ directive }) => this.directives.has(directive))
        .map((directive) => {
          directive.expression = el.getAttribute(directive.raw) ?? '';
          return directive;
        });
      await Promise.all(
        attrs.map((attr) =>
          this.directives.get(attr.directive)?.execute(el, attr, {
            reactive: reactive,
            evaluate: evaluate,
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
  directive(name: string, directive: Directive): this {
    this.directives.set(name, directive);
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

const parseAttributeName =
  (pre: string) =>
  (name: string): DirectiveInfo => {
    const [directivevalue, ...modifiers] = name.split('.');
    const [directive, value] = directivevalue.split(':');
    return {
      raw: name,
      directive: directive.slice(pre.length),
      value,
      modifiers,
      expression: '',
    };
  };
