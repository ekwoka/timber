import { Effect } from '../Effect';
import { nextTick } from '../nextTick';
import { reactive } from './reactive';
import { $CACHEGETTERS, $RAW } from './symbols';

describe.concurrent('reactive', () => {
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
  it('return self when object is already reactive', () => {
    const obj = reactive({
      foo: 42,
    });
    expect(reactive(obj)).toBe(obj);
  });
  describe.concurrent('objects', () => {
    it('handles nested reactive objects', async () => {
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
    it('does not cache getters', () => {
      let num = 0;
      const fn = vi.fn(() => ++num);
      const data = reactive({
        get foo() {
          return fn();
        },
      });
      expect(data.foo).to.not.equal(data.foo);
      expect(fn).toBeCalledTimes(2);
    });
    it('can cache all getters', () => {
      let num = 0;
      const fn = vi.fn(() => ++num);
      const data = reactive({
        get foo() {
          return fn();
        },
        get bar() {
          return fn();
        },
        [$CACHEGETTERS]: true,
      });
      expect(data.foo).to.equal(data.foo);
      expect(fn).toBeCalledTimes(1);
      expect(data.bar).to.equal(data.bar);
      expect(fn).toBeCalledTimes(2);
    });
    it('can cache only listed getters', () => {
      let num = 0;
      const fn = vi.fn(() => ++num);
      const data = reactive({
        get foo() {
          return fn();
        },
        get bar() {
          return fn();
        },
        [$CACHEGETTERS]: ['foo'],
      });
      expect(data.foo).to.equal(data.foo);
      expect(fn).toBeCalledTimes(1);
      expect(data.bar).to.not.equal(data.bar);
      expect(fn).toBeCalledTimes(3);
    });
    it('cached getters are reactive', async () => {
      const data = reactive({
        get foo() {
          return this.bar;
        },
        bar: 42,
        [$CACHEGETTERS]: true,
      });
      let value = 0;
      new Effect(() => (value = data.foo));
      expect(value).toBe(42);
      data.bar = 100;
      await nextTick();
      expect(value).toBe(100);
    });
  });
  describe.concurrent('arrays', () => {
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
    it('reacts to internal mutations', async () => {
      const data = reactive([1, 2, 3]);
      let first = 0;
      let second = 0;
      let third = 0;
      new Effect(() => ([first, second, third] = data));
      expect(first).toBe(1);
      expect(second).toBe(2);
      expect(third).toBe(3);
      data.sort((a, b) => b - a);
      await nextTick();
      expect(first).toBe(3);
      expect(second).toBe(2);
      expect(third).toBe(1);
    });
    it('reacts to array length mutation', async () => {
      const data = reactive([1, 2, 3]);
      let value = 0;
      new Effect(() => (value = data.reduce((a, b) => a + b, 0)));
      expect(value).toBe(6);
      data.length = 2;
      await nextTick();
      expect(value).toBe(3);
      data.push(4);
      await nextTick();
      expect(value).toBe(7);
      data.shift();
      await nextTick();
      expect(value).toBe(6);
    });
  });
});
