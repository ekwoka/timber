export const isSetter = (obj: object, key: string | symbol): boolean => {
  const descriptor = Object.getOwnPropertyDescriptor(obj, key);
  return !!descriptor?.set;
};
