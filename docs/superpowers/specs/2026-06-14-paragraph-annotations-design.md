# Paragraph Annotations (review-and-copy-to-AI)

**Date:** 2026-06-14
**Status:** Approved design — ready for implementation plan

## Goal

Let a user select any passage in the Block view, attach a free-text comment to
it, accumulate several such annotations, and then **Copy all** to the clipboard
as a single Markdown payload they can paste into an AI agent (e.g. Claude in a
terminal). UX modeled on https://www.agentation.com/.

This is a **review layer**, not document content. Annotations are ephemeral
(session-only) and never written to the `.md` file.

## Hard constraint that drives the architecture

`MdEditorPlusProvider` auto-saves the document to the `.md` file every ~1s by
serializing the editor's ProseMirror doc to Markdown. Therefore annotations
**must not live inside the document model** — anything in the doc gets written
to the file. We use ProseMirror **decorations** (an overlay that is not part of
the document) so the `.md` file stays byte-for-byte clean.

## Decisions (locked)

- **Lifecycle:** ephemeral / session-only. Lost when the editor closes. No
  persistence, no sidecar file, no markup in `.md`.
- **Copy format:** numbered Markdown with blockquoted excerpt (see below).
- **Display:** inline highlight + numbered badge in the document, plus a
  right-side panel listing all annotations.
- **Entry points:** a `💬 Comment` button in the existing bubble menu, plus a
  keyboard shortcut `Cmd/Ctrl+Opt+M` on a non-empty selection.
- **Panel toggle:** a button in the top editor toolbar (next to the existing
  eye / `</>` source toggles), showing the annotation count.
- **Scope:** Block view only. In Source (raw) view badges/panel are hidden in v1.

## Components

All new code is in `src/webview/`. Naming follows existing modules
(`outlinePanel.ts`, `bubbleMenu.ts`, `aiSelection.ts`).

### 1. `annotationStore.ts` — state + serializer (pure, unit-tested)

```ts
export interface Annotation {
  id: string;        // stable id, e.g. `a${counter}` (no Math.random — keep deterministic for tests)
  from: number;      // ProseMirror doc position
  to: number;        // ProseMirror doc position
  comment: string;
}

// Pure: given annotations + the current doc text accessor, produce the clipboard payload.
export function serializeAnnotations(
  anns: Annotation[],
  opts: { path: string; quoteAt: (from: number, to: number) => string },
): string;
```

Serializer output (the locked format):

```
Re: <relative path>

1. > <excerpt line 1>
   > <excerpt line 2>
   comment: <comment text>

2. > <excerpt>
   comment: <comment text>
```

- `path` comes from `getDocumentPath()` (docContext.ts).
- Excerpts are re-extracted from `[from,to]` **at copy time** via
  `quoteAt` (`doc.textBetween(from, to, '\n', ' ')`), so edits made after
  annotating are reflected.
- Multi-line excerpts: every line prefixed with `> `.
- Numbering follows document order (sorted by `from`).
- Empty list → returns `''` (caller skips the copy + shows "Nothing to copy").

This module has **no DOM/editor imports** so it is unit-testable like
`aiSelection.ts`.

### 2. `annotationExtension.ts` — TipTap extension wrapping a ProseMirror plugin

- Holds `Annotation[]` in plugin state.
- `apply(tr, state)`: maps every `from`/`to` through `tr.mapping`. Drops any
  annotation whose mapped range collapses (`from >= to`) — i.e. its text was
  deleted.
- Builds a `DecorationSet`:
  - `Decoration.inline(from, to, { class: 'mdep-annotation-hl', 'data-id': id })`
    for the highlight.
  - `Decoration.widget(from, () => badgeEl, { side: -1 })` for the numbered
    badge (number = 1-based document-order index).
- Exposes commands via plugin metadata / a small API object:
  `addAnnotation(from,to,comment)`, `updateComment(id,comment)`,
  `removeAnnotation(id)`, `clearAnnotations()`, `getAnnotations()`.
- Emits a change callback (`onChange`) so the panel + toolbar count re-render.
- Clicking a badge → calls a host callback to focus that annotation's row in
  the panel.

Position mapping note: when an external `update` (sync) replaces the whole doc,
positions may no longer be valid. v1 behavior: best-effort map; the standard
ProseMirror mapping already drops invalid ranges. We do **not** attempt content
re-anchoring in v1.

### 3. `annotationPanel.ts` — right-side panel (mirrors `outlinePanel.ts`)

`createAnnotationPanel({ editor, panelEl, toggleBtn, store })` → `{ toggle, render }`.

Renders, in document order:

```
┌─ Annotations (2) ─────── [Copy all] [Clear] ─┐
│ ① "glab issue update has no…"               ×│
│    <comment textarea, editable>               │
│ ② "Assign via the work-item GraphQL…"       ×│
│    <comment textarea, editable>               │
└────────────────────────────────────────────────┘
```

- Each row: badge number, truncated excerpt (reuse `truncateAnchor`), an
  editable comment field (debounced → `updateComment`), and `×` delete.
- Clicking a row (not the textarea/×) → scroll the editor to `from` and briefly
  flash the highlight (`mdep-annotation-flash` class for ~800ms).
- Header `[Copy all]` → `serializeAnnotations(...)` → `copyToClipboard(...)`.
- Header `[Clear]` → `clearAnnotations()` (with a confirm only if >0).
- Empty state: "Select text and add a comment to start."
- `toggleBtn` shows the count badge; panel visibility toggled like the outline
  panel.

### 4. Bubble-menu integration (`bubbleMenu.ts`)

- Add one button: `<button class="bm-btn" data-action="comment" data-tip-html="Comment<kbd>⌘⌥M</kbd>">${svg(P.chatBubble)}</button>`
  (add a `chatBubble` Phosphor path to the `P` icon map).
- In the action switch: on `comment`, capture the current selection
  `{from,to}`, open a tiny inline input popover (reuse the link-popover pattern
  already in this file) to type the comment; on Enter →
  `store.addAnnotation(from, to, value)` and open the panel.

### 5. Keyboard shortcut

- `Cmd/Ctrl+Opt+M` while a non-empty selection exists → same flow as the
  bubble-menu `comment` action (open the comment input for the selection).
  Registered as an editor keymap in the annotation extension.

### 6. Host glue (`mdEditorPlusProvider.ts`)

- Existing `copyText` message already writes to clipboard, but its toast is
  hard-coded to "AI prompt copied to clipboard". Add an optional
  `label?: string` to the `copyText` message; when present, show that instead
  (annotations pass `"Copied N annotation(s)"`). No other host changes.

### 7. HTML/CSS

- `_getHtml` in the provider: add the toolbar toggle button and an empty
  `<aside id="annotation-panel">` container (parallel to the outline panel).
- CSS: highlight style (`mdep-annotation-hl` — a distinct color from the
  existing user Highlight mark, e.g. a soft blue underline + tint), badge chip,
  flash animation, panel layout. Respect existing light/dark theme variables.

## Data flow

```
select text ──(bubble btn / ⌘⌥M)──▶ comment input ──▶ store.addAnnotation
                                                          │
        ┌─────────────────────────────────────────────────┤ onChange
        ▼                         ▼                         ▼
  plugin DecorationSet       panel.render()          toolbar count
 (highlight + badge)       (rows + comments)         (N)
        │
   user edits doc ──▶ tr.mapping remaps from/to (collapsed ⇒ dropped)
        │
   [Copy all] ──▶ serializeAnnotations(store, {path, quoteAt}) ──▶ copyToClipboard
```

## Error / edge cases

- **Empty selection** when invoking comment → no-op (button disabled / shortcut ignored).
- **Selection deleted later** → annotation auto-removed (mapped range collapses).
- **Overlapping selections** → allowed; each annotation is independent.
- **Selection inside a code block** → excerpt is plain text via `textBetween`.
- **Source view** → the feature is Block-view only in v1: the panel toggle
  button is disabled and badges are not rendered while in Source view.
  Annotations created in Block view survive a round-trip to Source view and
  back (state lives in the plugin, positions remap on the doc that backs both
  views).
- **Copy with 0 annotations** → no clipboard write; toast "Nothing to copy".

## Testing

- `tests/annotationStore.test.ts` (jest, like existing pure tests):
  - serializer: single, multiple (doc-order numbering), multi-line excerpt,
    empty list, path header.
  - reducer helpers: add assigns incremental id; remove; clear; position
    mapping drops a collapsed range (simulate a mapping function).
- DOM/editor pieces (decorations, panel, bubble button) verified manually in
  the Extension Host.

## Out of scope (v1, YAGNI)

Persistence, sidecar files, reply threads, per-annotation colors, exporting to
a file, multi-user/collab, annotations in Source view editing.
