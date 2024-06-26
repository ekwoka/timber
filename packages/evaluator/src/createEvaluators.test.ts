import { createEvaluators } from './createEvaluators';
import { functionFromExpression } from './functionFromExpression';

describe.concurrent('evaluate', () => {
  const { evaluate } = createEvaluators(functionFromExpression);
  it('immediately evalutes an expression', async () => {
    expect(await evaluate('foo + bar', { foo: 1, bar: 2 })).toBe(3);
  });
  it('can resolve synchronously with the state object', () => {
    const state = { foo: 1, bar: 2, result: null };
    expect(evaluate('result = foo + bar', state) instanceof Promise).toBe(true);
    expect(state.result).toBe(3);
  });
});
describe.concurrent('evaluateLater', () => {
  const { evaluateLater } = createEvaluators(functionFromExpression);
  it('returns a function that can be called later', async () => {
    const fn = evaluateLater('1 + 2');
    expect(await fn()).toBe(3);
  });
  it('binds the provided state', async () => {
    const fn = evaluateLater('foo + bar', { foo: 1, bar: 2 });
    expect(await fn()).toBe(3);
  });
});
