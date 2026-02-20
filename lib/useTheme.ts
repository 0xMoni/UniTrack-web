import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';

const THEME_KEY = 'unitrack_theme';

function getInitialDark(): boolean {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const emptySubscribe = () => () => {};

export function useTheme() {
  const initialDark = useSyncExternalStore(emptySubscribe, getInitialDark, () => false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [dark, setDark] = useState(initialDark);

  useEffect(() => {
    // Apply the class on mount to sync DOM with state
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(THEME_KEY, 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(THEME_KEY, 'light');
      }
      return next;
    });
  }, []);

  return { dark, toggle, mounted };
}
