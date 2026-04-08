import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  // 클라이언트에서만 localStorage 읽기 (Hydration Mismatch 방지)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch {}
  }, [key]);

  function set(v: T) {
    setValue(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }

  return [value, set];
}
