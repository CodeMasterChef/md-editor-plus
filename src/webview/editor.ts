import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import Callout from './extensions/callout';
import Toggle from './extensions/toggle';

const lowlight = createLowlight(common);

let _editor: Editor | null = null;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export type OnChangeCallback = (markdown: string) => void;

export function createEditor(
  element: HTMLElement,
  initialMarkdown: string,
  onChange: OnChangeCallback
): Editor {
  _editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Link.configure({ openOnClick: false }),
      Markdown.configure({ transformCopiedText: true }),
      Callout,
      Toggle,
    ],
    content: initialMarkdown,
    onUpdate({ editor }) {
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        const markdown = editor.storage.markdown.getMarkdown() as string;
        onChange(markdown);
      }, 500);
    },
  });

  return _editor;
}

export function updateContent(markdown: string): void {
  if (!_editor) return;
  _editor.commands.setContent(markdown);
}

export function destroyEditor(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _editor?.destroy();
  _editor = null;
}
