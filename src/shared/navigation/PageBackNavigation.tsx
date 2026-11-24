import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type PageBackAction = { label: string; onClick: () => void; disabled?: boolean };
type Register = (action: PageBackAction, priority?: number) => () => void;
const Context = createContext<{ register: Register; defaultLabel?: string } | null>(null);

export function PageBackScope({ enabled = true, register, defaultLabel, children }: { enabled?: boolean; register: Register; defaultLabel?: string; children: ReactNode }) {
  return <Context value={enabled ? { register, defaultLabel } : null}>{children}</Context>;
}
export function usePageBackLabel() { return useContext(Context)?.defaultLabel; }
export function PageBackLabel({ label, children }: { label: string; children: ReactNode }) {
  const context = useContext(Context);
  return <Context value={context ? { ...context, defaultLabel: label } : null}>{children}</Context>;
}

export function usePageBackRegistry() {
  const [actions, setActions] = useState<{ action: PageBackAction; priority: number }[]>([]);
  const register = useCallback<Register>((action, priority = 0) => {
    const entry = { action, priority };
    setActions((current) => [...current, entry]);
    return () => setActions((current) => current.filter((item) => item !== entry));
  }, []);
  const selected = actions.reduce<typeof actions[number] | undefined>((best, entry) => !best || entry.priority >= best.priority ? entry : best, undefined);
  return { back: selected?.action, register };
}

// Nested details take over the page's Back action while they are visible.
export function usePageBackAction({ label, onClick, disabled = false }: PageBackAction, priority = 0) {
  const register = useContext(Context)?.register;
  const callback = useRef(onClick);
  callback.current = onClick;
  useLayoutEffect(() => register?.({ label, disabled, onClick: () => callback.current() }, priority), [register, label, disabled, priority]);
  return !!register;
}
