const funcCache = new Map<
  string,
  (state: Record<string | symbol | number, unknown>) => unknown
>();

const hasDeclaration = /^(const|\s*let|\s*var)\s/;
const hasReturn = /^return\s/;
const hasSwitch = /^switch[\s(]/;
const hasIf = /^if[\s(]/;

const validityChecks = [hasDeclaration, hasReturn, hasSwitch, hasIf];
const isInvalidRHS = (expression: string) =>
  validityChecks.some((check) => check.test(expression));

export const anoop = async () => {};
const AsyncFunction = anoop.constructor;
export const functionFromExpression = <T>(expression: string) => {
  if (funcCache.has(expression))
    return funcCache.get(expression)! as (
      state: Record<string | symbol | number, unknown>,
    ) => Promise<T>;
  const blockBodyExpression = isInvalidRHS(expression)
    ? expression
    : `return ${expression}`;
  const func = tryOr(
    () => AsyncFunction('state', `with(state){${blockBodyExpression}}`),
    anoop,
  );
  funcCache.set(expression, func);
  if (func === anoop)
    console.error('Invalid Function Expression: ', expression);
  return func as (
    state: Record<string | symbol | number, unknown>,
  ) => Promise<T>;
};

const tryOr = <T>(fn: () => T, fallback: T) => {
  try {
    return fn();
  } catch (e) {
    return fallback;
  }
};
