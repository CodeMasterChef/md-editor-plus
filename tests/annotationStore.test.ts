import { createAnnotationStore, serializeAnnotations, Annotation } from '../src/webview/annotationStore';

describe('AnnotationStore', () => {
  test('add assigns incremental deterministic ids and stores fields', () => {
    const s = createAnnotationStore();
    const a = s.add(5, 10, 'first');
    const b = s.add(20, 25, 'second');
    expect(a).toEqual({ id: 'a1', from: 5, to: 10, comment: 'first' });
    expect(b.id).toBe('a2');
    expect(s.list().map(x => x.id)).toEqual(['a1', 'a2']);
  });

  test('list() returns annotations sorted by document position', () => {
    const s = createAnnotationStore();
    s.add(50, 60, 'late');
    s.add(5, 9, 'early');
    expect(s.list().map(x => x.from)).toEqual([5, 50]);
  });

  test('update changes only the comment', () => {
    const s = createAnnotationStore();
    const a = s.add(1, 4, 'old');
    s.update(a.id, 'new');
    expect(s.list()[0].comment).toBe('new');
  });

  test('remove deletes by id; clear empties', () => {
    const s = createAnnotationStore();
    const a = s.add(1, 4, 'x');
    s.add(8, 12, 'y');
    s.remove(a.id);
    expect(s.list().map(x => x.comment)).toEqual(['y']);
    s.clear();
    expect(s.list()).toEqual([]);
  });

  test('map remaps positions and drops a collapsed (deleted) range', () => {
    const s = createAnnotationStore();
    s.add(10, 20, 'shift');   // shift right by 3
    s.add(40, 50, 'deleted'); // collapse -> dropped
    const changed = s.map((pos) => {
      if (pos <= 20) return pos + 3;
      return 45; // forces 40->45 and 50->45 => from>=to
    });
    expect(changed).toBe(true);
    expect(s.list()).toEqual([{ id: 'a1', from: 13, to: 23, comment: 'shift' }]);
  });

  test('subscribe fires on every state-changing mutation; unsubscribe stops it', () => {
    const s = createAnnotationStore();
    const fn = jest.fn();
    const off = s.subscribe(fn);
    s.add(1, 2, 'a');     // emit 1
    s.add(3, 4, 'b');     // emit 2
    s.update('a1', 'x');  // emit 3
    s.clear();            // emit 4 (store was non-empty)
    expect(fn).toHaveBeenCalledTimes(4);
    s.clear();            // no-op on empty store -> no emit (guarded)
    expect(fn).toHaveBeenCalledTimes(4);
    off();
    s.add(5, 6, 'c');     // unsubscribed -> no emit
    expect(fn).toHaveBeenCalledTimes(4);
  });

  test('emits origin "user" for mutations and "map" for remapping', () => {
    const s = createAnnotationStore();
    const seen: string[] = [];
    s.subscribe((origin) => seen.push(origin));
    s.add(1, 5, 'a');                 // 'user'
    s.map((pos) => pos + 1);          // 'map'
    expect(seen).toEqual(['user', 'map']);
  });
});

describe('serializeAnnotations', () => {
  const quoteAt = (from: number, to: number) => `Q${from}-${to}`;

  test('empty list returns empty string', () => {
    expect(serializeAnnotations([], { path: 'x.md', quoteAt })).toBe('');
  });

  test('numbered markdown with path header, doc order, blockquote', () => {
    const anns: Annotation[] = [
      { id: 'a2', from: 40, to: 50, comment: 'second' },
      { id: 'a1', from: 5, to: 10, comment: 'first' },
    ];
    const out = serializeAnnotations(anns, { path: 'docs/plan.md', quoteAt });
    expect(out).toBe(
      'Re: docs/plan.md\n\n' +
      '1. > Q5-10\n' +
      '   comment: first\n\n' +
      '2. > Q40-50\n' +
      '   comment: second'
    );
  });

  test('multi-line excerpt prefixes every line with "> "', () => {
    const anns: Annotation[] = [{ id: 'a1', from: 0, to: 1, comment: 'c' }];
    const out = serializeAnnotations(anns, { path: 'f.md', quoteAt: () => 'line one\nline two' });
    expect(out).toBe(
      'Re: f.md\n\n' +
      '1. > line one\n' +
      '   > line two\n' +
      '   comment: c'
    );
  });

  test('lineAt tags each item with its source line range', () => {
    const anns: Annotation[] = [
      { id: 'a1', from: 5, to: 10, comment: 'first' },
      { id: 'a2', from: 40, to: 50, comment: 'second' },
    ];
    const lineAt = (from: number) =>
      from === 5 ? { startLine: 12, endLine: 18 } : { startLine: 30, endLine: 30 };
    const out = serializeAnnotations(anns, { path: 'docs/plan.md', quoteAt, lineAt });
    expect(out).toBe(
      'Re: docs/plan.md\n\n' +
      '1. [L12-L18] > Q5-10\n' +
      '   comment: first\n\n' +
      '2. [L30] > Q40-50\n' +
      '   comment: second'
    );
  });

  test('lineAt with unknown start line omits the tag for that item', () => {
    const anns: Annotation[] = [{ id: 'a1', from: 5, to: 10, comment: 'c' }];
    const lineAt = () => ({ startLine: null, endLine: null });
    const out = serializeAnnotations(anns, { path: 'f.md', quoteAt, lineAt });
    expect(out).toBe('Re: f.md\n\n1. > Q5-10\n   comment: c');
  });
});
