// @vitest-environment happy-dom

const elementContext = new WeakMap<Element, ComponentContext>();

export const addScopeToNode = (el: Element, scope: ArbitraryData) => {
  const context = elementContext.get(el) ?? { data: {} };
  context.data = scope;
  elementContext.set(el, context);
};

export const getContext = (el: Element) => elementContext.get(el);

export const nearestContext = (el: Element) => {
  while (el) {
    if (elementContext.has(el)) return elementContext.get(el);
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

if (import.meta.vitest) {
  describe('scope', () => {
    it('adds scope to the node', () => {
      const node = document.createElement('div');
      const scope = { foo: 'bar' };
      addScopeToNode(node, scope);
      expect(getContext(node)).toEqual({ data: scope });
    });
    it('can find the nearest context', () => {
      const node = document.createElement('div');
      const child = document.createElement('div');
      const scope = { foo: 'bar' };
      addScopeToNode(node, scope);
      node.append(child);
      expect(nearestContext(child)).toEqual({ data: scope });
    });
    it('refreshes scope', () => {
      const node = document.createElement('div');
      const scope = { foo: 'bar' };
      addScopeToNode(node, scope);
      refreshScope(node, {
        bar: 'baz',
        get name() {
          return this.bar + this.foo;
        },
      });
      expect(getContext(node)?.data.foo).toEqual('bar');
      expect(getContext(node)?.data.bar).toEqual('baz');
      expect(getContext(node)?.data.name).toEqual('bazbar');
    });
  });
}
