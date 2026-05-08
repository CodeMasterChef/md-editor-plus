import { toggleToMarkdown, parseToggleSummary } from '../src/webview/extensions/toggle';

describe('toggle serialization', () => {
  it('wraps content in details/summary markdown', () => {
    expect(toggleToMarkdown('Click to expand', 'Hidden content')).toBe(
      '<details>\n<summary>Click to expand</summary>\n\nHidden content\n\n</details>\n'
    );
  });

  it('handles empty content gracefully', () => {
    expect(toggleToMarkdown('Title', '')).toBe(
      '<details>\n<summary>Title</summary>\n\n\n\n</details>\n'
    );
  });
});

describe('toggle parsing', () => {
  it('identifies an opening details tag', () => {
    expect(parseToggleSummary('<details>')).toBe(true);
  });

  it('identifies details tag with attributes', () => {
    expect(parseToggleSummary('<details open>')).toBe(true);
  });

  it('rejects non-details HTML tags', () => {
    expect(parseToggleSummary('<div>')).toBe(false);
  });

  it('rejects plain text', () => {
    expect(parseToggleSummary('regular text')).toBe(false);
  });
});
