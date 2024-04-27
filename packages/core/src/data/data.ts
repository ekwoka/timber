const elementContext = new WeakMap<Element, ComponentContext>();

export const addScopeToNode = (el: Element, scope: ArbitraryData) => {
  const context = elementContext.get(el) ?? { data: {} };
  context.data = scope;
  elementContext.set(el, context);
};

export const getContext = (el: Element) => elementContext.get(el);

export const nearestContext = (el: Element) => {
  while (el) {
    if (elementContext.has(el)) return elementContext.get(el)!;
    el = el.parentElement!;
  }
  return null;
};

export const refreshScope = (el: Element, scope: ArbitraryData) => {
  const context = elementContext.get(el);
  if (!context) return;
  Object.defineProperties(
    context.data,
    Object.getOwnPropertyDescriptors(scope),
  );
};

export interface ComponentContext {
  data: ArbitraryData;
}

export type ArbitraryData = Record<string | symbol | number, unknown>;
