import { mergeReactiveStack } from './mergeReactiveStack';
import { reactive } from './reactive';

describe('mergeReactiveStack', () => {
  it('merges reactive stack', () => {
    const objects = [{ foo: 'bar' }, { bar: 'baz' }].map(reactive) as [
      { foo: string },
      { bar: string },
    ];
    const merged = mergeReactiveStack(objects);
    expect(Reflect.ownKeys(merged)).toEqual(['foo', 'bar']);
    merged.foo = 'fizz';
    expect(objects[0].foo).toBe('fizz');
    merged.bar = 'buzz';
    expect(objects[1].bar).toBe('buzz');
  });
  it('can be stringified', () => {
    const objects = [{ foo: 'bar' }, { bar: 'baz' }].map(reactive) as [
      { foo: string },
      { bar: string },
    ];
    const merged = mergeReactiveStack(objects);
    expect(JSON.stringify(merged)).toBe('{"foo":"bar","bar":"baz"}');
  });
});
