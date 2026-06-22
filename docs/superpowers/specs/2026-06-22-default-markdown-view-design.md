# Default Markdown View + Right-click "Open in Notion View"

**Date:** 2026-06-22
**Status:** Approved (design)

## Problem

The extension registers itself as the **default** custom editor for `.md` (and
`.markdown`, `.mdown`, `.mkd`, `.mdx`), so every markdown file auto-opens in the
Notion-style block editor. Some users want the opposite default: open markdown in
VS Code's **native text editor**, and switch a file into the Notion-style view
on demand (right-click → "Open in Notion View").

## Goal

1. Default behavior: `.md` opens in VS Code's native text editor ("markdown
   default, no Notion style").
2. A user setting `mdEditorPlus.defaultView` controls the default
   (`"markdown"` | `"notion"`), defaulting to `"markdown"`.
3. Switch the current/clicked file into the Notion-style editor via:
   - right-click inside the native text editor,
   - right-click on a markdown file in the Explorer,
   - a button in the editor title bar.
4. Reverse direction ("Open in Text View") available as a title-bar button when
   the Notion editor is active.

## Key finding (existing infrastructure)

`src/extension.ts` already registers the two commands that do the switching via
`vscode.openWith`:

- `mdEditorPlus.openBlockView` → `vscode.openWith(uri, 'md-editor-plus.editor')`
  (open in Notion view)
- `mdEditorPlus.openSourceView` → `vscode.openWith(uri, 'default')`
  (open in native text view)

They currently take no arguments (they read the active tab's URI), have no
user-facing menu placement, and the extension still auto-opens the block editor
because `priority` is `"default"`. This feature is therefore mostly **wiring +
a priority flip + a new setting**, not new plumbing.

## Design

### Behavior / data flow

- Custom editor `priority`: `"default"` → `"option"`. VS Code then opens markdown
  in the native text editor by default. **This is a deliberate behavior change
  for existing users** and must be called out in CHANGELOG.
- New setting `mdEditorPlus.defaultView`: enum `"markdown"` (default) | `"notion"`.
  - `"markdown"`: pure native default — no extra runtime code path. The user
    switches per-file via the menus/commands.
  - `"notion"`: an activation listener auto-reopens markdown text editors in the
    Notion editor, restoring the pre-change default for users who prefer it.
- Switching uses the existing commands; we only retitle them and wire menus.

### `package.json` changes

- Flip `priority` of the `md-editor-plus.editor` custom editor to `"option"`.
- Retitle commands for clarity (titles only; command IDs unchanged for
  backward compatibility):
  - `mdEditorPlus.openBlockView` → **"Open in Notion View"**, with an icon
    (e.g. `$(book)`).
  - `mdEditorPlus.openSourceView` → **"Open in Text View"**, with an icon
    (e.g. `$(code)`).
- Add `mdEditorPlus.defaultView` to `contributes.configuration.properties`:
  ```jsonc
  "mdEditorPlus.defaultView": {
    "type": "string",
    "enum": ["markdown", "notion"],
    "enumDescriptions": [
      "Markdown — open .md files in VS Code's native text editor",
      "Notion — open .md files in the Notion-style block editor"
    ],
    "default": "markdown",
    "description": "Which editor opens markdown files by default. Switch a single file any time via right-click → Open in Notion View."
  }
  ```
- Add a `contributes.menus` section (none exists today):
  - `editor/context`: "Open in Notion View"
    `when: resourceExtname =~ /\.(md|markdown|mdown|mkd|mdx)$/ && activeEditor == 'workbench.editors.files.textFileEditor'`
    (i.e. the markdown file is currently shown as plain text).
  - `explorer/context`: "Open in Notion View"
    `when: resourceExtname =~ /\.(md|markdown|mdown|mkd|mdx)$/`.
  - `editor/title`:
    - "Open in Notion View" `when` the active editor is a markdown text editor
      (same `when` as `editor/context`), `group: navigation`.
    - "Open in Text View" `when: activeCustomEditorId == 'md-editor-plus.editor'`,
      `group: navigation`.

  Exact `when` clause syntax (regex form vs. enumerated `||` of
  `resourceExtname == .md` etc.) will be finalized during implementation against
  the installed VS Code version; the enumerated form is the safe fallback.

### `extension.ts` changes

- Make `openBlockView` / `openSourceView` accept an **optional resource URI
  argument**. Menus (especially `explorer/context`) pass the clicked resource as
  the first argument; when absent, fall back to the active tab's URI as today.
- Add the `defaultView === "notion"` auto-open listener:
  - Subscribe to `vscode.window.onDidChangeActiveTextEditor`.
  - When the active editor is a markdown **text** document and
    `mdEditorPlus.defaultView === "notion"`, invoke `openBlockView` for that URI.
  - Guard with a per-session `Set<string>` of "force-text" URIs, populated when
    the user explicitly runs "Open in Text View", so the listener does not
    immediately reopen a file the user just switched back to text. The set holds
    `uri.toString()` keys and lives for the extension session only.

### Not touched

- The webview's custom right-click menu (`src/webview/contextMenu.ts`) is
  unchanged. "Right-click in the text editor" is VS Code's native editor context
  menu, served by the `editor/context` contribution — not the webview menu.
- No rendering/CSS changes. "Notion style" = the existing block editor;
  "markdown" = the native text editor. There is no new render mode.

## Testing

Manual (primary — this is editor-registration/menu wiring that unit tests can't
meaningfully cover):

1. With `defaultView` = `markdown` (default): open a `.md` → it opens in the
   native text editor.
2. Right-click in the text editor → "Open in Notion View" → file reopens in the
   Notion editor.
3. Right-click a `.md` in the Explorer → "Open in Notion View" → opens in Notion
   editor (works whether or not the file was already open).
4. Title-bar button toggles: text editor shows "Open in Notion View"; Notion
   editor shows "Open in Text View".
5. Set `defaultView` = `notion`: opening a `.md` auto-opens the Notion editor;
   invoking "Open in Text View" keeps it as text (listener does not fight it).

Regression:

- `npm test` (Jest) still passes — no webview logic changed.

## Out of scope

- A separate "plain markdown CSS" render mode inside the block editor.
- Per-workspace vs. global persistence of which view a specific file last used
  (relying on VS Code's own behavior + the explicit commands is sufficient).
