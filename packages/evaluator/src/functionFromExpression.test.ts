import { anoop, functionFromExpression } from './functionFromExpression';

describe.concurrent('functionFromString', () => {
  it('creates functions from expressions', async () => {
    const fn = functionFromExpression('foo + bar');
    expect(await fn({ foo: 1, bar: 2 })).toBe(3);
  });
  it('caches functions by expression', () => {
    const fn1 = functionFromExpression('foo + bar');
    const fn2 = functionFromExpression('foo + bar');
    expect(fn1).toBe(fn2);
  });
  it('can handle const/let/var', async () => {
    const fn = functionFromExpression(
      'const foo = 1; let bar = 2; var baz = 3; return foo + bar + baz',
    );
    expect(await fn({})).toBe(6);
  });
  it('can handle return statements', async () => {
    const fn = functionFromExpression('return foo + bar');
    expect(await fn({ foo: 1, bar: 2 })).toBe(3);
  });
  it('can handle switch statements', async () => {
    const fn = functionFromExpression('switch(foo){case 1: return bar}');
    expect(await fn({ foo: 1, bar: 2 })).toBe(2);
  });
  it('can handle if statements', async () => {
    const fn = functionFromExpression('if(foo){return bar}');
    expect(await fn({ foo: true, bar: 2 })).toBe(2);
  });
  it('returns a noop function if it fails', async () => {
    const fn = functionFromExpression('foo <> bar');
    expect(fn).toBe(anoop);
    expect(await fn({ foo: 1, bar: 2 })).toBe(undefined);
  });
});
