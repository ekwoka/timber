export const tada = () => '🎉';

if (import.meta.vitest) {
  it('works', () => {
    expect(tada()).toBe('🎉');
  });
}
