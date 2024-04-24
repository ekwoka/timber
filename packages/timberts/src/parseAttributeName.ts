import type { DirectiveInfo } from './directives';

export const parseAttributeName =
  (pre: string) =>
  (name: string): DirectiveInfo => {
    const [directivevalue, ...modifiers] = name.split('.');
    const [directive, value] = directivevalue.split(':');
    return {
      raw: name,
      directive: directive.slice(pre.length),
      value,
      modifiers,
      expression: '',
    };
  };
