import { shouldAutoOpenNotion } from '../src/defaultView';

describe('shouldAutoOpenNotion', () => {
  const base = {
    isMarkdown: true,
    defaultView: 'notion' as const,
    uriKey: 'file:///x/a.md',
    forcedText: new Set<string>(),
  };

  it('auto-opens markdown when default view is notion', () => {
    expect(shouldAutoOpenNotion(base)).toBe(true);
  });

  it('does not auto-open when default view is markdown', () => {
    expect(shouldAutoOpenNotion({ ...base, defaultView: 'markdown' })).toBe(false);
  });

  it('does not auto-open a non-markdown editor', () => {
    expect(shouldAutoOpenNotion({ ...base, isMarkdown: false })).toBe(false);
  });

  it('does not auto-open a URI the user forced to text', () => {
    expect(
      shouldAutoOpenNotion({ ...base, forcedText: new Set(['file:///x/a.md']) }),
    ).toBe(false);
  });
});
