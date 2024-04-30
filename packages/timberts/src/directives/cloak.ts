import type { DirectiveCallback } from '../directives';

export const Cloak: DirectiveCallback = (el, { attr }) =>
  queueMicrotask(() => el.removeAttributeNode(attr));
