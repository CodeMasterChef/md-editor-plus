// src/webview/boardBlock.ts
import { parseBoardSource, serializeBoard, type Board } from './boardModel';

export interface BoardView {
  dom: HTMLElement;
  update(source: string): void;
}

export function createBoardView(initialSource: string): BoardView {
  const dom = document.createElement('div');
  dom.className = 'board-block';
  dom.setAttribute('contenteditable', 'false');

  let board = parseBoardSource(initialSource);
  render();

  function render(): void {
    dom.innerHTML = '';
    dom.appendChild(renderChrome(board));
    dom.appendChild(renderColumns(board));
  }

  return {
    dom,
    update(source: string): void {
      board = parseBoardSource(source);
      render();
    },
  };
}

function renderChrome(board: Board): HTMLElement {
  const chrome = document.createElement('div');
  chrome.className = 'board-chrome';
  const name = document.createElement('div');
  name.className = 'board-name';
  name.textContent = board.name || 'Untitled board';
  if (!board.name) name.classList.add('is-placeholder');
  chrome.appendChild(name);
  return chrome;
}

function renderColumns(board: Board): HTMLElement {
  const row = document.createElement('div');
  row.className = 'board-columns';
  for (const col of board.columns) {
    row.appendChild(renderColumn(col));
  }
  return row;
}

function renderColumn(col: { name: string; color: string }): HTMLElement {
  const el = document.createElement('div');
  el.className = `board-column color-${col.color}`;
  const head = document.createElement('div');
  head.className = 'board-column-head';
  head.innerHTML = `
    <span class="board-column-dot" style="background:var(--color-${col.color})"></span>
    <span class="board-column-name">${col.name}</span>
  `;
  el.appendChild(head);
  return el;
}
