import type { DirectiveInfo } from './directives';

export const parseAttributeName = (
  pre: string,
  name: string,
): Omit<DirectiveInfo, 'attr'> => {
  const [directivevalue, ...modifiers] = name.split('.');
  const [directive, value] = directivevalue.split(':');
  return {
    raw: name,
    directive: directive.replace(pre, ''),
    value: value ?? '',
    modifiers,
    expression: '',
  };
};
