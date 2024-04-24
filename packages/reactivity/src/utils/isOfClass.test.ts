import { isMapType, isSetType, isWeakType } from './isOfClass';

describe.concurrent('isOfClass', () => {
  it('can identify Map Types', () => {
    expect(isMapType(new Map())).toBe(true);
    expect(isMapType(new WeakMap())).toBe(true);
    expect(isMapType(new Set())).toBe(false);
    expect(isMapType(new WeakSet())).toBe(false);
  });
  it('can identify Set Types', () => {
    expect(isSetType(new Map())).toBe(false);
    expect(isSetType(new WeakMap())).toBe(false);
    expect(isSetType(new Set())).toBe(true);
    expect(isSetType(new WeakSet())).toBe(true);
  });
  it('can identify Weak Types', () => {
    expect(isWeakType(new Map())).toBe(false);
    expect(isWeakType(new WeakMap())).toBe(true);
    expect(isWeakType(new Set())).toBe(false);
    expect(isWeakType(new WeakSet())).toBe(true);
  });
});
