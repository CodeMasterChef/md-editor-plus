import { parseBoardSource, serializeBoard } from '../../src/webview/boardModel';

const FIXTURES: { name: string; source: string }[] = [
  {
    name: 'full board with bodies',
    source: [
      `<!-- board:start id="b-a3f2" name="Sprint 12" columns="Todo|Doing|Done" column-colors="blue|amber|emerald" field-types="Title=text,Status=status,Owner=person,Due=date,Tags=tags,id=text" hidden-fields="id" -->`,
      ``,
      `| Title | Status | Owner | Due | Tags | id |`,
      `|---|---|---|---|---|---|`,
      `| Build the kanban block | Doing | @aviran | 2026-06-01 | feature, editor | c1 |`,
      `| Write round-trip tests | Todo |  |  | tests | c2 |`,
      ``,
      `<!-- board:body id="c1" -->`,
      ``,
      `## Goal`,
      `Add the table + comment parser, render the board view, support drag-drop.`,
      ``,
      `- subtask 1`,
      `- subtask 2`,
      ``,
      `<!-- board:body id="c2" -->`,
      ``,
      `Brief notes for c2.`,
      ``,
      `<!-- board:end -->`,
    ].join('\n'),
  },
  {
    name: 'empty board (no cards)',
    source: [
      `<!-- board:start id="b1" columns="Todo|Done" column-colors="blue|emerald" field-types="Title=text,Status=status" -->`,
      ``,
      `| Title | Status |`,
      `|---|---|`,
      ``,
      `<!-- board:end -->`,
    ].join('\n'),
  },
];

describe('board source round-trip', () => {
  for (const fix of FIXTURES) {
    it(`parse(serialize(parse(x))) deep-equals parse(x): ${fix.name}`, () => {
      const a = parseBoardSource(fix.source);
      const b = parseBoardSource(serializeBoard(a));
      expect(b).toEqual(a);
    });
  }
});
