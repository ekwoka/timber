export const cspFunctionFromExpression = <T>(expression: string) => {
  return (state: Record<string | symbol | number, unknown>): T => {
    const path = pathFromDotNotation(expression);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = path.reduce((acc, key) => acc[key], state as any);
    return value as T;
  };
};

const pathFromDotNotation = (path: string) => path.split(/\??\./);

if (import.meta.vitest) {
  describe('CSP safe evaluator', () => {
    it('can return a values from state object', () => {
      const state = { foo: 'bar', fizz: { buzz: 'fizzbuzz' } };
      expect(cspFunctionFromExpression('foo')(state)).toBe('bar');
      expect(cspFunctionFromExpression('fizz.buzz')(state)).toBe('fizzbuzz');
    });
    it('safely handles optional chaining', () => {
      const state = { foo: 'bar', fizz: { buzz: 'fizzbuzz' } };
      expect(cspFunctionFromExpression('foo?.bar')(state)).toBe(undefined);
      expect(cspFunctionFromExpression('fizz?.buzz')(state)).toBe('fizzbuzz');
    });
  });
}
