export const hasOwn = (target: object, key: string | symbol) =>
  Object.prototype.hasOwnProperty.call(target, key);
