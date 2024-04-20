export const walk =
  (cb: (el: HTMLElement) => Promise<void> | void) =>
  async (el: HTMLElement) => {
    await cb(el);
    Array.prototype.forEach.call(el.children, walk(cb));
  };

export const getRootElements = (el: HTMLElement) =>
  el.querySelectorAll(`[x-data]:not([x-data] [x-data])`);
