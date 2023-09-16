import { createEvaluators } from './createEvaluators';
import { cspFunctionFromExpression } from './cspFunctionFromExpression';

export const cspEvaluate = createEvaluators(cspFunctionFromExpression);
