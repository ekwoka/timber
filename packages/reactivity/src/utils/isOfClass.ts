export type MapTypes = Map<unknown, unknown> | WeakMap<object, unknown>;
export type SetTypes = Set<unknown> | WeakSet<object>;
export type WeakTypes = Set<unknown> | WeakSet<object>;

type hasToStringTag = {
  [Symbol.toStringTag]: string;
};

const isOfClass = (obj: hasToStringTag, classType: string): boolean =>
  obj[Symbol.toStringTag]?.includes(classType);

export const isWeakType = (obj: object): obj is WeakTypes =>
  isOfClass(obj as WeakTypes, 'Weak');

export const isSetType = (obj: object): obj is SetTypes =>
  isOfClass(obj as SetTypes, 'Set');

export const isMapType = (obj: object): obj is MapTypes =>
  isOfClass(obj as MapTypes, 'Map');

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
