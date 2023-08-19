export type MapTypes = Map<unknown, unknown> | WeakMap<object, unknown>;
export type SetTypes = Set<unknown> | WeakSet<object>;
export type WeakTypes = WeakMap<object, unknown> | WeakSet<object>;

export const isWeakType = (obj: object): obj is WeakTypes =>
  (obj as WeakTypes)[Symbol.toStringTag]?.includes('Weak');

export const isSetType = (obj: object): obj is SetTypes =>
  (obj as SetTypes)[Symbol.toStringTag]?.includes('Set');

export const isMapType = (obj: object): obj is MapTypes =>
  (obj as MapTypes)[Symbol.toStringTag]?.includes('Map');

if (import.meta.vitest) {
  describe('isOfClass', () => {
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
}
