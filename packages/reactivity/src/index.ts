import { Effect, effect, release, stop } from './Effect';
import type { ReactiveEffect } from './Effect';
import { Signal, untrack } from './Signal';
import { nextTick } from './nextTick';
import { $PROXY, $RAW, reactive, toRaw } from './reactive';

export {
  Signal,
  untrack,
  Effect,
  ReactiveEffect,
  effect,
  release,
  stop,
  reactive,
  toRaw,
};

declare global {
  interface ImportMeta {
    DEBUG: boolean;
  }
}

if (import.meta.vitest) {
  describe('reactivity', () => {
    it('creates signals wrapping values', () => {
      const signal = new Signal(1);
      expect(signal.get()).toBe(1);
      signal.set(42);
      expect(signal.get()).toBe(42);
    });
    it('can register reactive effects', async () => {
      const signal = new Signal(1);
      let value: number = 0;
      new Effect(() => (value = signal.get()));
      expect(value).toBe(1);
      signal.set(42);
      expect(value).toBe(1);
      await nextTick();
      expect(value).toBe(42);
    });
    it('disconnects all signals tracking when effect is triggered', async () => {
      const first = new Signal(5);
      const second = new Signal(10);
      let value: number = 0;
      const effect = new Effect(() => (value = first.get() + second.get()));
      expect(value).toBe(15);
      expect(first.dependents.size).toBe(1);
      expect(second.dependents.size).toBe(1);
      expect(effect.dependencies.size).toBe(2);
      first.set(42);
      expect(first.dependents.size).toBe(0);
      expect(second.dependents.size).toBe(0);
      expect(effect.dependencies.size).toBe(0);
      await nextTick();
      expect(value).toBe(52);
      expect(first.dependents.size).toBe(1);
      expect(second.dependents.size).toBe(1);
      expect(effect.dependencies.size).toBe(2);
    });
    it('can release effects', async () => {
      const signal = new Signal(1);
      let value: number = 0;
      const effect = new Effect(() => (value = signal.get()));
      expect(value).toBe(1);
      signal.set(42);
      await nextTick();
      expect(value).toBe(42);
      effect.release();
      signal.set(100);
      await nextTick();
      expect(value).toBe(42);
    });
    it('can run released effects', async () => {
      const signal = new Signal(1);
      let value: number = 0;
      const effect = new Effect(() => (value = signal.get()));
      expect(value).toBe(1);
      signal.set(42);
      await nextTick();
      expect(value).toBe(42);
      effect.release();
      signal.set(100);
      await nextTick();
      expect(value).toBe(42);
      effect.run();
      expect(value).toBe(100);
    });
    it('can create reactive objects', async () => {
      const data = reactive({
        foo: 0b1,
        bar: 0b10,
      });
      let value: number = 0b0;
      new Effect(() => (value = data.foo + data.bar));
      expect(value).toBe(0b11);
      data.foo = 0b100;
      expect(value).toBe(0b11);
      await nextTick();
      expect(value).toBe(0b110);
    });
    it('handled nested reactive objects', async () => {
      const info = reactive({
        names: {
          first: 'Foo',
          last: 'Bar',
        },
      });
      let value: string = '';
      new Effect(() => (value = `${info.names.first} ${info.names.last}`));
      expect(value).toBe('Foo Bar');
      info.names.first = 'Fizz';
      expect(value).toBe('Foo Bar');
      expect(`${info.names.first} ${info.names.last}`).toBe('Fizz Bar');
      info.names.last = 'Buzz';
      expect(value).toBe('Foo Bar');
      await nextTick();
      expect(value).toBe('Fizz Buzz');
      info.names = {
        first: 'Peter',
        last: 'Parker',
      };
      expect(value).toBe('Fizz Buzz');
      await nextTick();
      expect(value).toBe('Peter Parker');
      info.names.last = 'Porker';
      await nextTick();
      expect(value).toBe('Peter Porker');
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
    it('can handle reactive arrays', async () => {
      const arr = reactive([0b1, 0b10, 0b100]);
      let value = 0b0;
      new Effect(() => {
        value = arr.reduce((a, b) => a + b, 0);
      });
      expect(value).toBe(0b111);
      arr.push(0b1000);
      await nextTick();
      expect(value).toBe(0b1111);
    });
    it('does not rerun effects on reassignment of same array', async () => {
      const data = reactive({
        items: [1, 2, 3],
      });
      let value = 0;
      const effect = vi.fn(
        () => (value = data.items.reduce((a, b) => a + b, 0)),
      );
      new Effect(effect);
      expect(value).toBe(6);
      expect(effect).toHaveBeenCalledTimes(1);
      const items = data.items;
      items.splice(1, 1);
      await nextTick();
      expect(value).toBe(4);
      expect(effect).toHaveBeenCalledTimes(2);
      data.items = items;
      await nextTick();
      expect(value).toBe(4);
      expect(effect).toHaveBeenCalledTimes(2);
      data.items = items.map((i) => i * 2);
      await nextTick();
      expect(value).toBe(8);
      expect(effect).toHaveBeenCalledTimes(3);
    });
    it('can handle getters', async () => {
      const data = reactive({
        innerFoo: 42,
        get foo() {
          return this.innerFoo;
        },
      });
      let value = 0;
      new Effect(() => (value = data.foo));
      expect(value).toBe(42);
      data.innerFoo = 100;
      await nextTick();
      expect(value).toBe(100);
    });
    it('can handle setters', async () => {
      const data = reactive({
        innerFoo: 42,
        set foo(value: number) {
          this.innerFoo = value;
        },
      });
      let value = 0;
      new Effect(() => (value = data.innerFoo));
      expect(value).toBe(42);
      data.foo = 100;
      await nextTick();
      expect(value).toBe(100);
    });
    it('can handle getter/setter pairs', async () => {
      const data = reactive({
        innerFoo: 42,
        get foo() {
          return this.innerFoo;
        },
        set foo(value: number) {
          this.innerFoo = value;
        },
      });
      let value = 0;
      new Effect(() => (value = data.foo));
      expect(value).toBe(42);
      data.foo = 100;
      await nextTick();
      expect(value).toBe(100);
    });
    it('allows accessing the $PROXY on the passed in object', () => {
      const obj = { value: 42 };
      const proxy = reactive(obj);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(obj[$PROXY]).toBe(proxy);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(proxy[$PROXY]).toBe(proxy);
    });
    it('allows accessing the raw object from the $RAW property', () => {
      const obj = { value: 42 };
      const proxy = reactive(obj);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(proxy[$RAW]).toBe(obj);
    });
    it('returns the same proxy when wrapping the same target', () => {
      const obj = { value: 42 };
      const proxy = reactive(obj);
      expect(reactive(obj)).toBe(proxy);
    });
    it('recursivley wraps nested reactive objects', () => {
      const obj = reactive({
        foo: {
          bar: 42,
        },
      });
      const proxy = obj.foo;
      expect(proxy).toBe(obj.foo);
      expect(proxy.bar).toBe(42);
      expect(proxy.bar).toBe(obj.foo.bar);
    });
    it('return self when object is already reactive', () => {
      const obj = reactive({
        foo: 42,
      });
      expect(reactive(obj)).toBe(obj);
    });
  });
}
