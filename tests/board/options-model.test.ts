import { parseBoardSource, serializeBoard, getStatusOptions, setStatusOptions } from '../../src/webview/boardModel';
import type { Board } from '../../src/webview/boardModel';

describe('10-color palette', () => {
  it('parses and preserves a new color token (teal) on a column', () => {
    const src = `<!-- board:start id="b1" columns="A|B" column-colors="teal|indigo" field-types="Title=text,Status=status" -->\n\n<!-- board:end -->`;
    const board = parseBoardSource(src);
    expect(board.columns).toEqual([
      { name: 'A', color: 'teal' },
      { name: 'B', color: 'indigo' },
    ]);
    expect(serializeBoard(board)).toContain('column-colors="teal|indigo"');
  });
});

function makeBoard(): Board {
  return {
    id: 'b1', name: '',
    columns: [{ name: 'Todo', color: 'blue' }, { name: 'Done', color: 'emerald' }],
    fields: [
      { name: 'Title',  type: 'text',   visibleOnCard: true },
      { name: 'Status', type: 'status', visibleOnCard: true },
      { name: 'Impact', type: 'status', visibleOnCard: true, options: [{ name: 'Low', color: 'gray' }] },
    ],
    cards: [{ id: 'c1', values: { id: 'c1', Title: 'A', Status: 'Todo', Impact: 'Low' }, body: '' }],
    orphanBodies: [], views: [], activeView: 'kanban',
  };
}

describe('status-option accessors', () => {
  it('getStatusOptions returns board.columns for the built-in Status field', () => {
    expect(getStatusOptions(makeBoard(), 'Status')).toEqual([
      { name: 'Todo', color: 'blue' }, { name: 'Done', color: 'emerald' },
    ]);
  });
  it('getStatusOptions returns field.options for additional status fields', () => {
    expect(getStatusOptions(makeBoard(), 'Impact')).toEqual([{ name: 'Low', color: 'gray' }]);
  });
  it('getStatusOptions returns [] for a status field with no options', () => {
    const b = makeBoard();
    b.fields.push({ name: 'Risk', type: 'status', visibleOnCard: true });
    expect(getStatusOptions(b, 'Risk')).toEqual([]);
  });
  it('setStatusOptions writes board.columns for Status, immutably', () => {
    const b = makeBoard();
    const next = setStatusOptions(b, 'Status', [{ name: 'X', color: 'red' }]);
    expect(next.columns).toEqual([{ name: 'X', color: 'red' }]);
    expect(b.columns).toHaveLength(2);
  });
  it('setStatusOptions writes field.options for additional status fields, immutably', () => {
    const b = makeBoard();
    const next = setStatusOptions(b, 'Impact', [{ name: 'High', color: 'red' }]);
    expect(next.fields.find(f => f.name === 'Impact')!.options).toEqual([{ name: 'High', color: 'red' }]);
    expect(b.fields.find(f => f.name === 'Impact')!.options).toEqual([{ name: 'Low', color: 'gray' }]);
  });
});
