// @vitest-environment happy-dom
import {
  addScopeToNode,
  getContext,
  nearestContext,
  refreshScope,
} from './data';

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
