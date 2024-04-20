export class Directives {
  private directives = new Map<string, Directive>();
  register(_directive: Directive) {}
}

type Directive = {
  (el: HTMLElement, utils: Record<string, unknown>);
};
