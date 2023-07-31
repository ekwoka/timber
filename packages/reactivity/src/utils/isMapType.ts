export const isMapType = (obj: unknown): obj is MapTypes => {
  return obj instanceof Map || obj instanceof WeakMap;
};

export type MapTypes = Map<unknown, unknown> | WeakMap<object, unknown>;
