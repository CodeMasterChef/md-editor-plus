/**
 * @jest-environment jsdom
 */
import { autoColorPublic, COLOR_TOKENS_PUBLIC } from '../../src/webview/boardModel';

describe('autoColorPublic', () => {
  it('returns a valid palette token, deterministically', () => {
    const a = autoColorPublic('backend');
    const b = autoColorPublic('backend');
    expect(a).toBe(b);
    expect(COLOR_TOKENS_PUBLIC).toContain(a);
  });
  it('different names can map to different tokens', () => {
    const names = ['a','b','c','d','e','f','g','h','i','j','k'];
    const uniq = new Set(names.map(autoColorPublic));
    expect(uniq.size).toBeGreaterThan(1);
  });
});
