import { functionFromExpression } from './functionFromExpression';

export const evaluateLater = <T>(expression: string, state = {}) => {
  return functionFromExpression<T>(expression).bind(null, state);
};

if (import.meta.vitest) {
  describe.concurrent('evaluateLater', () => {
    it('returns a function that can be called later', async () => {
      const fn = evaluateLater('1 + 2');
      expect(await fn()).toBe(3);
    });
    it('binds the provided state', async () => {
      const fn = evaluateLater('foo + bar', { foo: 1, bar: 2 });
      expect(await fn()).toBe(3);
    });
  });
}
