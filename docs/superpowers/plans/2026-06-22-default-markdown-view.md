# Default Markdown View + Right-click "Open in Notion View" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `.md` files open in VS Code's native text editor by default, with a setting and right-click/Explorer/title-bar commands to open a file in the Notion-style block editor.

**Architecture:** Flip the custom editor's `priority` to `"option"` so the native text editor is the default. Reuse the two existing `vscode.openWith` commands (`openBlockView`/`openSourceView`), give them user-facing titles, and wire them into `menus`. Add a `mdEditorPlus.defaultView` setting; when set to `"notion"`, an `onDidChangeActiveTextEditor` listener auto-reopens markdown text editors in the Notion editor, gated by a pure decision helper.

**Tech Stack:** TypeScript, VS Code Extension API (`@types/vscode` ^1.74.0), Jest + ts-jest for unit tests, esbuild for the webview bundle.

## Global Constraints

- VS Code engine floor: `^1.74.0` — do not use APIs newer than that.
- Custom editor `viewType` is `md-editor-plus.editor` (used verbatim in `vscode.openWith`).
- Markdown extensions are the single source of truth in `src/openPath.ts`: `MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mdx']`; use `isMarkdownPath()` from that module — do not re-list extensions in TS code.
- Command IDs stay unchanged for backward compatibility: `mdEditorPlus.openBlockView`, `mdEditorPlus.openSourceView`. Only titles/icons/menus change.
- Setting namespace prefix is `mdEditorPlus.`.
- Tests run with `npm test` (Jest). Test files live in `tests/` and import from `../src/...`.

---

### Task 1: Pure decision helper `shouldAutoOpenNotion`

The only piece of logic worth unit-testing in isolation: given the current state, should the listener auto-reopen a markdown text editor in the Notion view? Keeping it pure (no `vscode` import) makes it Jest-testable and keeps `extension.ts` thin.

**Files:**
- Create: `src/defaultView.ts`
- Test: `tests/defaultView.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type DefaultView = 'markdown' | 'notion';
  export function shouldAutoOpenNotion(opts: {
    isMarkdown: boolean;
    defaultView: DefaultView;
    uriKey: string;
    forcedText: ReadonlySet<string>;
  }): boolean;
  ```
  Returns `true` only when `isMarkdown === true`, `defaultView === 'notion'`, and `uriKey` is **not** in `forcedText`.

- [ ] **Step 1: Write the failing test**

Create `tests/defaultView.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/defaultView.test.ts`
Expected: FAIL — `Cannot find module '../src/defaultView'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/defaultView.ts`:

```ts
export type DefaultView = 'markdown' | 'notion';

export function shouldAutoOpenNotion(opts: {
  isMarkdown: boolean;
  defaultView: DefaultView;
  uriKey: string;
  forcedText: ReadonlySet<string>;
}): boolean {
  return (
    opts.isMarkdown &&
    opts.defaultView === 'notion' &&
    !opts.forcedText.has(opts.uriKey)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/defaultView.test.ts`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/defaultView.ts tests/defaultView.test.ts
git commit -m "feat(default-view): add shouldAutoOpenNotion decision helper"
```

---

### Task 2: `package.json` — priority flip, setting, command titles, menus

Static manifest changes only. No TS. This is the bulk of the user-visible behavior.

**Files:**
- Modify: `package.json` (the `contributes` block: `customEditors` priority ~line 69, `commands` ~lines 72-81, `configuration.properties`, plus a new `menus` block)

**Interfaces:**
- Consumes: command IDs `mdEditorPlus.openBlockView` / `mdEditorPlus.openSourceView` (defined; wired in Task 3).
- Produces: the `mdEditorPlus.defaultView` setting read by Task 3.

- [ ] **Step 1: Flip the custom editor priority**

In `package.json`, inside `contributes.customEditors[0]`, change:

```json
        "priority": "default"
```

to:

```json
        "priority": "option"
```

- [ ] **Step 2: Retitle the two commands and add icons**

Replace the `contributes.commands` array with:

```json
    "commands": [
      {
        "command": "mdEditorPlus.openSourceView",
        "title": "Open in Text View",
        "category": "MD Editor Plus",
        "icon": "$(code)"
      },
      {
        "command": "mdEditorPlus.openBlockView",
        "title": "Open in Notion View",
        "category": "MD Editor Plus",
        "icon": "$(book)"
      }
    ],
```

- [ ] **Step 3: Add the `defaultView` setting**

In `contributes.configuration.properties`, add this property (place it first, before `mdEditorPlus.theme`):

```json
        "mdEditorPlus.defaultView": {
          "type": "string",
          "enum": [
            "markdown",
            "notion"
          ],
          "enumDescriptions": [
            "Markdown — open markdown files in VS Code's native text editor",
            "Notion — open markdown files in the Notion-style block editor"
          ],
          "default": "markdown",
          "description": "Which editor opens markdown files by default. You can switch any single file at any time via right-click → Open in Notion View."
        },
```

- [ ] **Step 4: Add the `menus` contribution**

Add a `menus` key inside `contributes` (e.g. directly after the `commands` array). The `when` clauses enumerate the markdown extensions with `||` (the safe, version-stable form):

```json
    "menus": {
      "editor/context": [
        {
          "command": "mdEditorPlus.openBlockView",
          "when": "editorTextFocus && !activeCustomEditorId && (resourceExtname == .md || resourceExtname == .markdown || resourceExtname == .mdown || resourceExtname == .mkd || resourceExtname == .mdx)",
          "group": "navigation@10"
        }
      ],
      "explorer/context": [
        {
          "command": "mdEditorPlus.openBlockView",
          "when": "resourceExtname == .md || resourceExtname == .markdown || resourceExtname == .mdown || resourceExtname == .mkd || resourceExtname == .mdx",
          "group": "navigation@10"
        }
      ],
      "editor/title": [
        {
          "command": "mdEditorPlus.openBlockView",
          "when": "!activeCustomEditorId && (resourceExtname == .md || resourceExtname == .markdown || resourceExtname == .mdown || resourceExtname == .mkd || resourceExtname == .mdx)",
          "group": "navigation@1"
        },
        {
          "command": "mdEditorPlus.openSourceView",
          "when": "activeCustomEditorId == md-editor-plus.editor",
          "group": "navigation@1"
        }
      ]
    },
```

- [ ] **Step 5: Validate the manifest parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json OK')"`
Expected: prints `package.json OK` (no JSON syntax error).

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "feat(default-view): native text default, defaultView setting, switch menus"
```

---

### Task 3: `extension.ts` — optional URI arg, force-text guard, auto-open listener

Wire the commands so Explorer/menu invocations pass the clicked resource, track URIs the user forced to text, and auto-open Notion when the setting says so.

**Files:**
- Modify: `src/extension.ts` (full rewrite of the file — current body is 33 lines)

**Interfaces:**
- Consumes: `shouldAutoOpenNotion`, `DefaultView` from `src/defaultView.ts` (Task 1); `isMarkdownPath` from `src/openPath.ts`; the `mdEditorPlus.defaultView` setting (Task 2).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Rewrite `src/extension.ts`**

Replace the entire contents of `src/extension.ts` with:

```ts
import * as vscode from 'vscode';
import { MdEditorPlusProvider } from './mdEditorPlusProvider';
import { isMarkdownPath } from './openPath';
import { shouldAutoOpenNotion, DefaultView } from './defaultView';

const NOTION_EDITOR = 'md-editor-plus.editor';

/** Resolve the target URI for a command: explicit arg (Explorer/menu) wins,
 *  else fall back to the active tab's URI. */
function resolveTargetUri(arg: unknown): vscode.Uri | undefined {
  if (arg instanceof vscode.Uri) return arg;
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  if (input && typeof input === 'object' && 'uri' in input) {
    return (input as { uri: vscode.Uri }).uri;
  }
  return undefined;
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(MdEditorPlusProvider.register(context));

  // URIs the user explicitly switched back to the native text view this session.
  // Prevents the auto-open listener from immediately re-opening them in Notion.
  const forcedText = new Set<string>();

  const getDefaultView = (): DefaultView =>
    vscode.workspace.getConfiguration('mdEditorPlus').get<DefaultView>('defaultView', 'markdown');

  context.subscriptions.push(
    vscode.commands.registerCommand('mdEditorPlus.openSourceView', async (arg?: unknown) => {
      const uri = resolveTargetUri(arg);
      if (!uri) return;
      forcedText.add(uri.toString());
      await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mdEditorPlus.openBlockView', async (arg?: unknown) => {
      const uri = resolveTargetUri(arg);
      if (!uri) return;
      forcedText.delete(uri.toString());
      await vscode.commands.executeCommand('vscode.openWith', uri, NOTION_EDITOR);
    }),
  );

  // When defaultView === 'notion', reopen markdown text editors in the Notion editor.
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) return;
      const uri = editor.document.uri;
      if (
        shouldAutoOpenNotion({
          isMarkdown: isMarkdownPath(uri.fsPath),
          defaultView: getDefaultView(),
          uriKey: uri.toString(),
          forcedText,
        })
      ) {
        void vscode.commands.executeCommand('vscode.openWith', uri, NOTION_EDITOR);
      }
    }),
  );
}

export function deactivate(): void {}
```

- [ ] **Step 2: Type-check the extension build**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: no errors (exit code 0, no output).

- [ ] **Step 3: Run the full unit-test suite (regression)**

Run: `npm test`
Expected: all suites pass, including `tests/defaultView.test.ts`. No suite references the rewritten `extension.ts`, so nothing should break.

- [ ] **Step 4: Compile the extension + webview bundle**

Run: `npm run compile`
Expected: `tsc` then esbuild complete with no errors; `dist/extension.js` is regenerated.

- [ ] **Step 5: Commit**

```bash
git add src/extension.ts
git commit -m "feat(default-view): URI-aware switch commands + notion auto-open listener"
```

---

### Task 4: CHANGELOG entry + manual verification

Document the behavior change (existing users now get the native text editor by default) and verify the end-to-end flows the unit tests can't cover.

**Files:**
- Modify: `CHANGELOG.md` (top entry)

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: nothing.

- [ ] **Step 1: Add a CHANGELOG entry**

At the top of `CHANGELOG.md` (matching the existing heading style there), add an "Unreleased" / next-version entry containing:

```markdown
### Changed
- Markdown files now open in VS Code's native text editor by default. Set
  `mdEditorPlus.defaultView` to `notion` to restore opening in the Notion-style
  block editor by default.

### Added
- "Open in Notion View" command — available via right-click in the text editor,
  right-click on a markdown file in the Explorer, and the editor title bar.
- "Open in Text View" title-bar button when a file is open in the Notion editor.
```

- [ ] **Step 2: Launch the Extension Development Host**

Open this folder in VS Code and press `F5` (or run the "Run Extension" launch config in `.vscode/launch.json`). A second VS Code window ("Extension Development Host") opens with the extension loaded.

- [ ] **Step 3: Verify the default-markdown flow**

In the dev-host window, with `mdEditorPlus.defaultView` at its default (`markdown`):
1. Open `demo.md` → it opens in the **native text editor** (you see raw markdown).
2. Right-click in the editor → context menu shows **"Open in Notion View"**; click it → the file reopens in the Notion block editor.
3. In the Notion editor's title bar, confirm an **"Open in Text View"** button appears; click it → back to raw text.
4. In the Explorer, right-click `demo.md` → **"Open in Notion View"** appears and opens the block editor.
Expected: all four behave as described.

- [ ] **Step 4: Verify the notion-default flow**

In the dev-host window, set `mdEditorPlus.defaultView` to `notion` (Settings UI or `settings.json`):
1. Close `demo.md`, then reopen it → it auto-opens in the **Notion editor**.
2. Click the title-bar **"Open in Text View"** → it switches to text and **stays** text (the listener does not yank it back to Notion).
Expected: both behave as described.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(default-view): changelog for default markdown view + switch commands"
```

---

## Self-Review

**Spec coverage:**
- Default = native text editor → Task 2 Step 1 (`priority: "option"`). ✓
- `mdEditorPlus.defaultView` setting, default `markdown` → Task 2 Step 3. ✓
- Switch via text-editor right-click → Task 2 Step 4 (`editor/context`). ✓
- Switch via Explorer right-click → Task 2 Step 4 (`explorer/context`). ✓
- Title-bar button (both directions) → Task 2 Step 4 (`editor/title`). ✓
- `notion` default auto-opens, with force-text guard → Task 1 + Task 3. ✓
- Commands accept optional resource URI → Task 3 Step 1 (`resolveTargetUri`). ✓
- Webview/`contextMenu.ts` untouched → no task modifies it. ✓
- CHANGELOG calls out behavior change → Task 4 Step 1. ✓
- Regression: `npm test` → Task 3 Step 3. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N"; every code step shows full code. ✓

**Type consistency:** `shouldAutoOpenNotion` signature and `DefaultView` type are identical between Task 1 (definition) and Task 3 (consumption); `forcedText` is a `Set<string>` keyed by `uri.toString()` in both the helper test and the listener; command IDs and `NOTION_EDITOR` constant match the manifest `viewType`. ✓
