import { Signal } from '../Signal';

export const reactiveNodes = new WeakMap<object, Map<unknown, Signal>>();
