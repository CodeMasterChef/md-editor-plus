// Ephemeral, in-memory annotation state for the review-and-copy-to-AI layer.
// No DOM/editor imports — unit-tested in isolation. Annotations are never part
// of the document; they live here and are rendered as ProseMirror decorations.

export interface Annotation {
  id: string;
  from: number;
  to: number;
  comment: string;
}

export interface AnnotationStore {
  list(): Annotation[];
  add(from: number, to: number, comment: string): Annotation;
  update(id: string, comment: string): void;
  remove(id: string): void;
  clear(): void;
  /**
   * Remap every annotation's positions through `mapPos`. Annotations whose
   * range collapses (from >= to) are dropped. Returns true if anything changed.
   */
  map(mapPos: (pos: number, assoc?: number) => number): boolean;
  subscribe(fn: () => void): () => void;
}

export function createAnnotationStore(): AnnotationStore {
  let counter = 0;
  let items: Annotation[] = [];
  const subs = new Set<() => void>();

  const emit = (): void => { subs.forEach((fn) => fn()); };
  const sorted = (): Annotation[] => [...items].sort((a, b) => a.from - b.from);

  return {
    list: sorted,
    add(from, to, comment) {
      const ann: Annotation = { id: `a${++counter}`, from, to, comment };
      items.push(ann);
      emit();
      return ann;
    },
    update(id, comment) {
      const ann = items.find((x) => x.id === id);
      if (ann) { ann.comment = comment; emit(); }
    },
    remove(id) {
      const next = items.filter((x) => x.id !== id);
      if (next.length !== items.length) { items = next; emit(); }
    },
    clear() {
      if (items.length) { items = []; emit(); }
    },
    map(mapPos) {
      let changed = false;
      const next: Annotation[] = [];
      for (const a of items) {
        const from = mapPos(a.from, 1);
        const to = mapPos(a.to, -1);
        if (from >= to) { changed = true; continue; }
        if (from !== a.from || to !== a.to) changed = true;
        next.push({ ...a, from, to });
      }
      if (changed) { items = next; emit(); }
      return changed;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
  };
}

/**
 * Serialize annotations to the clipboard payload pasted into an AI agent.
 * Excerpts are produced on demand by `quoteAt` (re-read from the live doc so
 * post-annotation edits are reflected).
 */
export function serializeAnnotations(
  anns: Annotation[],
  opts: { path: string; quoteAt: (from: number, to: number) => string },
): string {
  if (anns.length === 0) return '';
  const ordered = [...anns].sort((a, b) => a.from - b.from);
  const blocks = ordered.map((a, i) => {
    const lines = opts.quoteAt(a.from, a.to).split('\n');
    const quoted = lines
      .map((line, idx) => (idx === 0 ? `${i + 1}. > ${line}` : `   > ${line}`))
      .join('\n');
    return `${quoted}\n   comment: ${a.comment}`;
  });
  return `Re: ${opts.path}\n\n${blocks.join('\n\n')}`;
}
