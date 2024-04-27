type FunctionCreator = <T>(
  expression: string,
) => (scope: ArbitraryData) => Promise<T>;

type ArbitraryData = Record<string | symbol | number, unknown>;

export const createEvaluators = (functionFromExpression: FunctionCreator) => {
  const evaluate = <T>(expression: string, state = {}) => {
    return functionFromExpression<T>(expression)(state);
  };
  const evaluateLater = <T>(expression: string, state = {}) => {
    return functionFromExpression<T>(expression).bind(null, state);
  };
  return { evaluate, evaluateLater };
};
