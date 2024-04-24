export type MapTypes = Map<unknown, unknown> | WeakMap<object, unknown>;
export type SetTypes = Set<unknown> | WeakSet<object>;
export type WeakTypes = WeakMap<object, unknown> | WeakSet<object>;

export const isWeakType = (obj: object): obj is WeakTypes =>
  (obj as WeakTypes)[Symbol.toStringTag]?.includes('Weak');

export const isSetType = (obj: object): obj is SetTypes =>
  (obj as SetTypes)[Symbol.toStringTag]?.includes('Set');

export const isMapType = (obj: object): obj is MapTypes =>
  (obj as MapTypes)[Symbol.toStringTag]?.includes('Map');
