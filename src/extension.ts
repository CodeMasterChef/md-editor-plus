import * as vscode from 'vscode';
import { MdEditorPlusProvider } from './mdEditorPlusProvider';
import { isMarkdownPath } from './openPath';
import { shouldAutoOpenNotion } from './defaultView';
import type { DefaultView } from './defaultView';

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

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      forcedText.delete(doc.uri.toString());
    }),
  );

  // When defaultView === 'notion', reopen markdown text editors in the Notion editor.
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) return;
      if (editor.document.uri.scheme !== 'file') return;
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
