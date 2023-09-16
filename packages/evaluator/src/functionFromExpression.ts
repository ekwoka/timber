const funcCache = new Map<
  string,
  (state: Record<string | symbol | number, unknown>) => unknown
>();

const hasDeclaration = /^(const|\s*let|\s*var)\s/;
const hasReturn = /^return\s/;
const hasSwitch = /^switch[\s(]/;
const hasIf = /^if[\s(]/;

const validityChecks = [hasDeclaration, hasReturn, hasSwitch, hasIf];
const isInvalidRHS = (expression: string) =>
  validityChecks.some((check) => check.test(expression));

const anoop = async () => {};
const AsyncFunction = anoop.constructor;
export const functionFromExpression = <T>(expression: string) => {
  if (funcCache.has(expression))
    return funcCache.get(expression)! as (
      state: Record<string | symbol | number, unknown>,
    ) => Promise<T>;
  const blockBodyExpression = isInvalidRHS(expression)
    ? expression
    : `return ${expression}`;
  const func = tryOr(
    () => AsyncFunction('state', `with(state){${blockBodyExpression}}`),
    anoop,
  );
  funcCache.set(expression, func);
  if (func === anoop && !import.meta.vitest)
    console.error('Invalid Function Expression: ', expression);
  return func as (
    state: Record<string | symbol | number, unknown>,
  ) => Promise<T>;
};

const tryOr = <T>(fn: () => T, fallback: T) => {
  try {
    return fn();
  } catch (e) {
    return fallback;
  }
};

if (import.meta.vitest) {
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
}
