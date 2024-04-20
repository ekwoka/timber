import { click } from './directives/click';
import { data } from './directives/data';
import { text } from './directives/text';
import { getRootElements, walk } from '@timberts/walker/src';

export class Timber {
  private pre = 'x-';
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
    initTree(this.treeRoot, (el) => {
      console.log(el);
      if (el.getAttribute(`${this.pre}text`)) text(el);
      if (el.getAttribute(`@click`)) click(el);
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
}

const initTree = async (
  el: HTMLElement,
  cb: (el: HTMLElement) => Promise<void> | void,
) => {
  const roots = getRootElements(el);
  console.log(roots);
  await Promise.all(Array.prototype.map.call(roots, data));
  roots.forEach(walk(cb));
};

export default Timber;
