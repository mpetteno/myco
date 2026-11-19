import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
const Context = createContext('');
// Preserved, hidden screens must not shadow labels on the active screen.
export function FieldScope({ prefix, children }: { prefix: string; children: ReactNode }) {
  const parent = useContext(Context);
  return <Context value={parent + prefix}>{children}</Context>;
}
export const useFieldPrefix = () => useContext(Context);
export function useScopedId(id: string) {
  const prefix = useFieldPrefix();
  return prefix && !id.startsWith(prefix) ? prefix + id : id;
}
