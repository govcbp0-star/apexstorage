'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const pathname = usePathname();
  // Theme switching only applies to dashboard routes; public pages stay dark.
  const isDashboard = pathname?.startsWith('/dashboard') ?? false;

  useEffect(() => {
    const stored = localStorage.getItem('apex-theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDashboard ? theme : 'dark');
    if (isDashboard) {
      localStorage.setItem('apex-theme', theme);
    }
  }, [theme, isDashboard]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
