import { Effect } from './Effect';
import { Signal, computed, untrack } from './Signal';
import { nextTick } from './nextTick';

describe.concurrent('Signal', () => {
  it('wraps values with Signal', () => {
    const signal = new Signal(1);
    expect(signal.get()).toBe(1);
    signal.set(42);
    expect(signal.get()).toBe(42);
  });
  it('can untrack inside an effect', async () => {
    const first = new Signal(5);
    const second = new Signal(10);
    let value: number = 0;
    new Effect(() => {
      const initial = first.get();
      untrack(() => (value = initial + second.get()));
    });
    expect(value).toBe(15);
    first.set(42);
    await nextTick();
    expect(value).toBe(52);
    second.set(100);
    await nextTick();
    expect(value).toBe(52);
  });
  it('knows it is a Signal', () =>
    expect(new Signal(1).toString()).toEqual('[object Signal]'));
});
describe.concurrent('computed Signal', () => {
  it('can derive a Signal from a function', () => {
    const computedSignal = computed(() => 1);
    expect(computedSignal.get()).toBe(1);
  });
  it('reruns when dependencies change', async () => {
    const first = new Signal(5);
    const second = new Signal(10);
    const computedSignal = computed(() => first.get() + second.get());
    expect(computedSignal.get()).toBe(15);
    first.set(42);
    await nextTick();
    expect(computedSignal.get()).toBe(52);
    second.set(100);
    await nextTick();
    expect(computedSignal.get()).toBe(142);
  });
});
