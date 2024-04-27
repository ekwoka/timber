export function collapseReactiveStack(this: Record<string, unknown>) {
  const keys = Reflect.ownKeys(this);
  const collapsed = keys.reduce(
    (acc, key) => {
      acc[key] = Reflect.get(this, key);
      return acc;
    },
    {} as Record<string | symbol | number, unknown>,
  );
  return collapsed;
}

export const mergeReactiveStack = <T extends ArbitraryData[]>(
  objects: T,
): collapse<T> => {
  const thisProxy = new Proxy({ objects }, proxyMerger);

  return thisProxy as unknown as collapse<T>;
};

type wrappedProxy = {
  objects: object[];
};

const proxyMerger: ProxyHandler<wrappedProxy> = {
  ownKeys(proxies) {
    return Array.from(new Set(proxies.objects.flatMap((i) => Object.keys(i))));
  },
  has(proxies, name) {
    if (name == Symbol.unscopables) return false;

    return proxies.objects.some((obj) => Reflect.has(obj, name));
  },
  get(proxies, name, thisProxy) {
    if (name == 'toJSON') return collapseReactiveStack;
    return Reflect.get(
      proxies.objects.find((obj) => Reflect.has(obj, name)) ?? {},
      name as string,
      thisProxy,
    );
  },
  set(proxies, name, value, thisProxy) {
    const target =
      proxies.objects.find((obj) => Reflect.has(obj, name)) ||
      proxies.objects.at(-1);
    if (!target) return false;
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    if (descriptor?.set && descriptor?.get)
      return Reflect.set(target, name, value, thisProxy);
    return Reflect.set(target, name, value);
  },
};

type ArbitraryData = Record<string | symbol | number, unknown>;

type collapse<T extends ArbitraryData[]> =
  | {
      [K in AllKeys<T[number]>]: FirstValueOf<T, K>;
    }
  | never;

type FirstValueOf<
  T extends ArbitraryData[],
  key extends keyof T[number],
> = T extends [infer L, ...infer R extends ArbitraryData[]]
  ? L extends {
      [k in key]: infer V;
    }
    ? V
    : FirstValueOf<R, key>
  : never;

type AllKeys<T> = T extends unknown ? keyof T : never;
