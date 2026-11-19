import { useRef, useState } from 'react';
import type { SetStateAction } from 'react';

// Keep recent local edits only. Restoring a snapshot goes through the caller's
// normal validation/save path; it never changes the server version.
export function useUndoState<T>(initial: T) {
  const [value, render] = useState(initial);
  const current = useRef(initial);
  const past = useRef<T[]>([]), future = useRef<T[]>([]);

  function setValue(update: SetStateAction<T>) {
    const next = typeof update === 'function' ? (update as (previous: T) => T)(current.current) : update;
    if (JSON.stringify(next) === JSON.stringify(current.current)) return false;
    future.current = [];
    past.current = [...past.current.slice(-19), current.current];
    current.current = next;
    render(next);
    return true;
  }
  function undo() {
    if (!past.current.length) return null;
    const next = past.current.pop()!;
    future.current.push(current.current);
    current.current = next;
    render(next);
    return next;
  }
  function redo() {
    if (!future.current.length) return null;
    const next = future.current.pop()!;
    past.current = [...past.current.slice(-19), current.current];
    current.current = next;
    render(next);
    return next;
  }
  function reset(next: T) {
    past.current = []; future.current = [];
    current.current = next;
    render(next);
  }
  return { value, current, setValue, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
