export const nextTick = () => new Promise<void>((res) => queueMicrotask(res));
