// TEMPORARY DIAGNOSTIC: visible flash toast (mirrors boardTableRender.dbgFlash).
// Remove once drag interactions are verified working.
function flashDbg(label: string, color: string): void {
  let el = document.getElementById('bd-dbg-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bd-dbg-toast';
    el.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;background:#000;color:#fff;font:600 11px monospace;padding:6px 10px;border-radius:6px;pointer-events:none;opacity:0;transition:opacity 0.1s;';
    document.body.appendChild(el);
  }
  el.style.background = color;
  el.textContent = label;
  el.style.opacity = '1';
  clearTimeout((el as unknown as { _t?: number })._t);
  (el as unknown as { _t?: number })._t = window.setTimeout(() => { el!.style.opacity = '0'; }, 1200);
}

/** A drop indicator element with show/hide helpers. */
export interface DropIndicator extends HTMLDivElement {
  show: (left: number, top: number, width: number, height: number) => void;
  hide: () => void;
}

export function dropIndicator(): DropIndicator {
  const el = document.createElement('div') as DropIndicator;
  el.className = 'bd-drop-line';
  el.dataset.role = 'drop-indicator';
  el.style.position = 'absolute';
  el.style.pointerEvents = 'none';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = '0';
  el.style.height = '0';
  el.show = (left, top, width, height) => {
    el.style.left   = `${left}px`;
    el.style.top    = `${top}px`;
    el.style.width  = `${width}px`;
    el.style.height = `${height}px`;
    el.classList.add('bd-drop-line-visible');
  };
  el.hide = () => {
    el.classList.remove('bd-drop-line-visible');
  };
  return el;
}

/** Threshold in CSS pixels before a mousedown promotes to a drag. */
export const DRAG_THRESHOLD_PX = 4;

/** Minimal manual drag wiring. Caller owns its own state.
 *
 * Usage:
 *   const cancel = startDrag(e, { onMove, onDrop, onCancel });
 *   // The returned function cancels the drag and invokes onCancel.
 *   // Internal mouseup handling unwires automatically (no need to call cancel).
 */
export function startDrag(
  startEvent: MouseEvent,
  opts: {
    onMove:    (e: MouseEvent) => void;
    onDrop:    (e: MouseEvent) => void;
    onCancel?: () => void;
  },
): () => void {
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;
  let moved = false;

  const onMove = (e: MouseEvent) => {
    if (!moved) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      moved = true;
      // TEMPORARY DIAGNOSTIC: announce drag promotion. Remove once verified.
      flashDbg('startDrag promoted', '#7c2d12');
    }
    opts.onMove(e);
  };

  const onUp = (e: MouseEvent) => {
    teardown();
    if (moved) {
      flashDbg('startDrag onDrop', '#16a34a');
      opts.onDrop(e);
    } else {
      flashDbg('startDrag onCancel (no drag)', '#dc2626');
      opts.onCancel?.();
    }
  };

  // Internal teardown — just remove listeners, no callback.
  const teardown = () => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup',   onUp,   true);
  };

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup',   onUp,   true);

  // Returned cancel — unwires AND fires onCancel so the caller knows.
  return () => {
    teardown();
    opts.onCancel?.();
  };
}
