import { filterBlocks, BLOCK_DEFS } from '../src/webview/blockPicker';

describe('filterBlocks', () => {
  it('returns all blocks when query is empty', () => {
    expect(filterBlocks('')).toHaveLength(BLOCK_DEFS.length);
  });

  it('filters by label case-insensitively', () => {
    const results = filterBlocks('head');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(b =>
      b.label.toLowerCase().includes('head') ||
      b.description.toLowerCase().includes('head') ||
      b.id.toLowerCase().includes('head')
    )).toBe(true);
  });

  it('returns empty array for no matches', () => {
    expect(filterBlocks('zzznomatch')).toHaveLength(0);
  });

  it('finds heading1 when querying "h1"', () => {
    const ids = filterBlocks('h1').map(b => b.id);
    expect(ids).toContain('heading1');
  });

  it('finds image block when querying "image"', () => {
    const ids = filterBlocks('image').map(b => b.id);
    expect(ids).toContain('image');
  });
});

describe('board block picker entry', () => {
  const board = BLOCK_DEFS.find((b) => b.id === 'board');

  it('is registered', () => {
    expect(board).toBeDefined();
  });

  it('has the expected label and aliases', () => {
    expect(board!.label).toBe('Board');
    expect(board!.aliases).toEqual(expect.arrayContaining(['kanban', 'tasks', 'project']));
  });

  it('lives in the "other" section', () => {
    expect(board!.section).toBe('other');
  });

  it('declares an insert handler (not a sub-menu)', () => {
    expect(typeof board!.insert).toBe('function');
    expect(board!.subItems).toBeUndefined();
  });
});
