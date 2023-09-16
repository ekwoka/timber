import { createEvaluators } from './createEvaluators';
import { functionFromExpression } from './functionFromExpression';

const { evaluate, evaluateLater } = createEvaluators(functionFromExpression);

export { evaluate, evaluateLater };
