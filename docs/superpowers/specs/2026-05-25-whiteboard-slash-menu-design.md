# Whiteboard slash-menu entry — design

A new top-level slash-menu entry, **Whiteboard**, that drops a
ready-to-draw mermaid block onto the page: three starter nodes wired
together, positions pre-pinned, visual-edit palette open. Zero clicks
between "type `/whiteboard`" and "drag the first node."

## Why

Today, getting a freeform mermaid canvas takes:

1. `/code` → pick the code-block entry.
2. Click into the language field, type `mermaid`.
3. Type or paste a flowchart header + nodes.
4. Click **Edit** in the block chrome to enter visual mode.
5. Drag a node to pin positions (or paste a `%% mb-positions:` line).

That sequence is friction for a feature the visual-edit phases 1–8
have already made first-class. Most of that plumbing (pinned
positions, multi-select, palette, freeform lines, copy/paste, align)
only pays off once the user is *in* visual mode — but discovery and
entry are hidden. A single slash-menu entry that lands the user
directly inside the canvas, on a seeded layout, makes the existing
investment visible.

## What ships

- **One new entry in `BLOCK_DEFS`** — labelled "Whiteboard," section
  "Media & blocks," aliases `mermaid` / `diagram` / `flowchart` /
  `graph` / `canvas`, a Phosphor "Graph" icon.
- **Starter source** — `flowchart LR` + three nodes (`Idea`, `Next`,
  `Done`) + two edges + a `%% mb-positions:` sidecar pinning the
  three nodes on a horizontal line.
- **Auto-open hook** — the mermaid NodeView exposes
  `__mbOpenVisualMode` on its DOM element; the slash-menu insert
  calls it one animation frame after insertion to flip the block
  into visual mode.

## What does not change

- No new ProseMirror node type. The block is a normal `codeBlock`
  with `language: 'mermaid'`, indistinguishable from any other
  mermaid block after insertion.
- No schema changes, no new node attrs.
- No changes to markdown round-trip — the inserted source serializes
  exactly like any other ` ```mermaid ` block.
- No changes to the visual editor, the palette, fullscreen, copy,
  expand, or any other mermaid-block behaviour. Everything reused.

## Architecture

Flow when the user hits Enter on the Whiteboard entry:

```
blockPicker.insert(editor, pos)
    │
    ├─ build starter source via freshWhiteboardSource()
    │
    ├─ editor.chain().insertContentAt(pos, [
    │     { type: 'codeBlock', attrs: { language: 'mermaid' },
    │       content: [{ type: 'text', text: source }] },
    │     { type: 'paragraph' }            ← landing spot below
    │   ]).run()
    │
    └─ requestAnimationFrame(() => {
          const dom = editor.view.nodeDOM(pos) as HTMLElement | null
          dom?.__mbOpenVisualMode?.()      ← hook on the NodeView
       })
```

The single new integration point on the NodeView side, added inside
`buildMermaidView` in `src/webview/extensions/mermaidBlock.ts`:

```ts
(dom as Element & { __mbOpenVisualMode?: () => void })
  .__mbOpenVisualMode = () => {
  if (canEdit(currentSource())) setVisualEditing(true);
};
```

The `canEdit` guard is future-proofing: the starter source is
guaranteed parseable today, but if anyone later changes the starter
to syntax the visual editor can't drive (subgraphs, sequence
diagrams, …) the hook degrades to a no-op rather than throwing or
showing a broken palette.

### Two subtleties, called out

**Position handle after insert.** `pos` continues to point at the
head of the freshly inserted code block — `insertContentAt` does
not shift the original anchor forward past the inserted content. So
`view.nodeDOM(pos)` returns the new mermaid `.mb` element, not the
trailing paragraph. A test locks this in (see Testing below) so a
future ProseMirror upgrade can't silently break the auto-open.

**One animation frame, not zero.** The NodeView is built
synchronously inside `insertContentAt`, but the mermaid SVG renders
on the next animation frame — the existing NodeView path at
`mermaidBlock.ts:380` already uses one `requestAnimationFrame` for
the same reason. Calling `__mbOpenVisualMode` on frame 0 binds the
visual editor's overlays to an empty SVG host (zero-rect bounding
boxes, palette mis-positioned). One rAF puts us on frame 1, after
mermaid has painted, so overlays measure correctly.

## Starter source format

```
flowchart LR
    %% mb-positions: {"A":[120,80],"B":[320,80],"C":[520,80]}
    A[Idea]
    B[Next]
    C[Done]
    A --> B
    B --> C
```

**Direction `LR`.** Positions are pinned, so direction barely
affects layout — but LR routes edges horizontally between nodes,
which matches the horizontal pinned arrangement.

**Coordinates.** Mermaid viewBox units. Nodes sit on `y=80` with
~200-unit spacing. Comfortable margin in the default preview height
(~200px tall for a single row of small nodes), leaves drag room on
all sides.

**Labels `Idea` / `Next` / `Done`.** Neutral, hint at a flow,
trivially overwritable. Not `A`/`B`/`C` (reads as placeholder
noise) and not `Start`/`Middle`/`End` (too prescriptive).

**Indentation: 4 spaces.** Matches what `serializeMermaidAst`
emits, so a user who inserts and immediately undoes-then-redoes
sees no diff.

## Files changed

- `src/webview/blockPicker.ts`
  - Add a `whiteboard` glyph to the `ICO` constant.
  - Append one new entry to `BLOCK_DEFS` (`id: 'whiteboard'`,
    section `media`).
  - Add `freshWhiteboardSource()` and `insertWhiteboard()` helpers,
    placed next to the existing `freshBoardSource()` /
    `insertBoardWith()` at the bottom of the file.
- `src/webview/extensions/mermaidBlock.ts`
  - One new line inside `buildMermaidView`, just before the
    `return { dom, contentDOM, … }`, attaching
    `__mbOpenVisualMode` to `dom`.
- `tests/mermaid/whiteboard-insert.test.ts` *(new)*
  - Three tests, jsdom environment. See Testing below.

No other files touched.

## Testing

One new file, `tests/mermaid/whiteboard-insert.test.ts`, jsdom
environment, mirroring `tests/mermaid/lines.test.ts` and
`tests/board/drag-shared-dom.test.ts`.

### Test 1 — starter source parses + round-trips

- Build source via `freshWhiteboardSource()`.
- Run through `parseMermaid()`.
- Assert: 3 node decls (`A`, `B`, `C`), 2 edge decls (`A→B`,
  `B→C`), positions map present with the documented coordinates,
  `canEdit()` returns `true`.
- Re-serialize via `serializeMermaidAst()`; assert byte-for-byte
  equality with the original. Locks down "insert + undo = clean."

### Test 2 — slash-menu insert builds the right tree

- Spin up the tiptap editor in jsdom.
- Call the Whiteboard `BlockDef.insert(editor, insertPos)`.
- Assert: node at `insertPos` is a `codeBlock` with
  `attrs.language === 'mermaid'`; its text content equals
  `freshWhiteboardSource()`; the node immediately after is a
  `paragraph`.
- This is the test that nails Point 1 from the Architecture
  section.

### Test 3 — auto-open hook is wired

- After insert, wait one `requestAnimationFrame`.
- Assert `editor.view.nodeDOM(insertPos)` returns the `.mb`
  element.
- Assert `dom.__mbOpenVisualMode` is a function.
- Invoke it; assert `dom.classList.contains('mb-visual')` — the
  class `setVisualEditing(true)` adds at `mermaidBlock.ts:214`.
  That's the externally observable signal that visual mode is on
  (the `visualHandle` itself is closure-local).

### What we do not test here

Visual-editor internals — drag, palette positioning, edge wiring,
multi-select, copy/paste, align/distribute. Those are covered by
the phase 1–8 specs and their existing tests. This file only proves
the new wiring between the slash menu, the inserted node, and the
hook. Mermaid SVG rendering stays mocked the same way
`lines.test.ts` mocks it.

## Manual verification

Type-check, build, install the extension, then in a `.md` file:

1. `/whiteboard` → confirm the entry appears under "Media &
   blocks," with aliases reachable via `/mermaid`, `/diagram`,
   `/flowchart`.
2. Enter on the entry → the block lands with three labelled nodes
   on a horizontal row, edges connecting them, palette already
   open over the canvas.
3. Drag a node → position pin update flows as in any other pinned
   mermaid block.
4. Undo immediately after insert → the entire block disappears
   (single undo step, since the chain is a single transaction).
5. Type `/whiteboard` again on a new line → second instance
   inserts and auto-opens independently of the first.

## Out of scope

- Pre-loaded shape palettes beyond what the existing visual editor
  already exposes.
- A "blank" canvas variant with zero starter nodes. The user chose
  three starter nodes in brainstorming; if a blank variant is
  desired later it can be a second sub-item.
- Drawing / inking layers, sticky notes, image stamps. The
  whiteboard here is mermaid-shaped; it inherits whatever the
  mermaid visual editor supports.
- Diagram-kind variants in the slash menu (Sequence, State, Gantt).
  The user opted explicitly for a single top-level Whiteboard
  entry, not a Mermaid sub-menu.
