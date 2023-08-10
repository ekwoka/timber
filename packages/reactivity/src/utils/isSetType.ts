export type SetTypes = Set<unknown> | WeakSet<object>;

export const isSetType = (obj: unknown): obj is SetTypes =>
  obj instanceof Set || obj instanceof WeakSet;
