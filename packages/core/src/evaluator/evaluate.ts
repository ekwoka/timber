import { functionFromExpression } from './functionFromExpression';

export const evaluate = (expression: string, state = {}) => {
  return functionFromExpression(expression)(state);
};

if (import.meta.vitest) {
  describe.concurrent('evaluate', () => {
    it('immediately evalutes an expression', async () => {
      expect(await evaluate('foo + bar', { foo: 1, bar: 2 })).toBe(3);
    });
    it('can resolve synchronously with the state object', () => {
      const state = { foo: 1, bar: 2, result: null };
      expect(evaluate('result = foo + bar', state) instanceof Promise).toBe(
        true,
      );
      expect(state.result).toBe(3);
    });
  });
}
