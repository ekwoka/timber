export type MapTypes = Map<unknown, unknown> | WeakMap<object, unknown>;

export const isMapType = (obj: unknown): obj is MapTypes =>
  obj instanceof Map || obj instanceof WeakMap;
