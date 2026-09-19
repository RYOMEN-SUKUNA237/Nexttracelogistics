import { useEffect, useRef } from 'react';

/**
 * Close the top-most dialog on Escape.
 *
 * Dialogs stack (the edit and pause modals open over the shipment detail one),
 * so every open dialog registers here and only the last one registered reacts.
 * Without that, one Escape would close the whole stack at once.
 */
const stack: Array<() => void> = [];

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || stack.length === 0) return;
  // Let inputs that use Escape themselves (the place search dropdown) go first.
  if (e.defaultPrevented) return;
  stack[stack.length - 1]();
}

export default function useEscapeKey(close: () => void, active = true) {
  // Callers pass inline arrows; keeping the latest one in a ref means the
  // dialog registers once instead of re-stacking on every render.
  const latest = useRef(close);
  latest.current = close;

  useEffect(() => {
    if (!active) return;
    const handler = () => latest.current();
    if (stack.length === 0) document.addEventListener('keydown', onKeyDown);
    stack.push(handler);
    return () => {
      const i = stack.lastIndexOf(handler);
      if (i !== -1) stack.splice(i, 1);
      if (stack.length === 0) document.removeEventListener('keydown', onKeyDown);
    };
  }, [active]);
}
