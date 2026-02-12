import { useMemo, useState } from 'react';

// Initial extracted hook shell for inventory state ownership.
export function useInventoryState<T>(initial: T) {
  const [state, setState] = useState(initial);
  const snapshot = useMemo(() => state, [state]);

  return { state, setState, snapshot };
}
