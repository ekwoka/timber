export const isObject = (obj: unknown): obj is object =>
  typeof obj === 'object' && obj !== null;
