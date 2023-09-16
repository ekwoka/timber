export const nextTick = () =>
  new Promise<void>((res) => queueMicrotask(() => setTimeout(res, 0)));
