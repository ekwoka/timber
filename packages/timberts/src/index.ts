import { evaluate, evaluateLater } from '../../evaluator/src';
import { effect, reactive } from '../../reactivity/src';

export class Timber {
  constructor(private treeRoot = document.body) {}
  start() {
    initTree(this.treeRoot);
  }
}

export class Directives {
  private directives = new Map<string, Directive>();
  register(_directive: Directive) {}
}

type Directive = {
  (el: HTMLElement, utils: Record<string, unknown>);
};

const initTree = async (el: HTMLElement) => {
  const roots = getRootElements(el);
  console.log(roots);
  await Promise.all(Array.prototype.map.call(roots, data));
  roots.forEach(walk);
};

const walk = (el: HTMLElement) => {
  if (el.getAttribute('x-text')) text(el);
  if (el.getAttribute('@click')) click(el);
  Array.prototype.forEach.call(el.children, walk);
};

const elementContext = new WeakMap<HTMLElement, Record<string, unknown>>();

const data = async (el: HTMLElement) => {
  const context = elementContext.get(el) ?? elementContext.set(el, {}).get(el);
  const expression = el.getAttribute('x-data');
  console.log('x-data', expression);
  const value = await evaluate(expression);
  console.log(value);
  context.data = reactive(value);
};

const text = (el: HTMLElement) => {
  const root = getNearestRoot(el);
  const expression = el.getAttribute('x-text');
  console.log('x-text', expression);
  const evaluate = evaluateLater(expression, root.data);
  effect(async () => console.log((el.textContent = await evaluate())));
};

const click = (el: HTMLElement) => {
  const root = getNearestRoot(el);
  const expression = el.getAttribute('@click');
  console.log('@click', expression);
  el.addEventListener('click', () => {
    evaluate(expression, root.data);
  });
};

const getNearestRoot = (el: HTMLElement) => {
  if (!el) return null;
  const context = elementContext.get(el);
  if (context?.data) return context;
  return getNearestRoot(el.parentElement);
};

export default Timber;

const getRootElements = (el: HTMLElement) =>
  el.querySelectorAll(`[x-data]:not([x-data] [x-data])`);
