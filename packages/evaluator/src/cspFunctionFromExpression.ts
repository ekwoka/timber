export const cspFunctionFromExpression = <T>(expression: string) => {
  return (state: Record<string | symbol | number, unknown>): T => {
    const path = pathFromDotNotation(expression);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = path.reduce((acc, key) => acc[key], state as any);
    return value as T;
  };
};

const pathFromDotNotation = (path: string) => path.split(/\??\./);
