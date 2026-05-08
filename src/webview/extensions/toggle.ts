import { Node, mergeAttributes } from '@tiptap/core';

const DETAILS_PATTERN = /^<details(\s[^>]*)?>/i;

export function toggleToMarkdown(summary: string, content: string): string {
  return `<details>\n<summary>${summary}</summary>\n\n${content}\n\n</details>\n`;
}

export function parseToggleSummary(line: string): boolean {
  return DETAILS_PATTERN.test(line.trim());
}

const Toggle = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      summary: { default: 'Toggle' },
    };
  },

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes),
      ['summary', {}, node.attrs.summary as string],
      ['div', { class: 'toggle-content' }, 0],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const content = node.textContent as string;
          state.write(toggleToMarkdown(node.attrs.summary, content));
          state.ensureNewLine();
        },
      },
    };
  },
});

export default Toggle;
