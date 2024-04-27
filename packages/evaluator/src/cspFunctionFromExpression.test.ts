import { cspFunctionFromExpression } from './cspFunctionFromExpression';

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
