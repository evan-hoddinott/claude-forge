import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeName = 'forge' | 'clean';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  loaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'forge',
  setTheme: () => {},
  toggleTheme: () => {},
  loaded: false,
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('forge');
  const [loaded, setLoaded] = useState(false);

  // Load theme from preferences on mount
  useEffect(() => {
    window.electronAPI.preferences.get().then((prefs) => {
      const t = prefs.theme as string;
      if (t === 'forge' || t === 'clean') {
        setThemeState(t);
      } else {
        // Migrate old values (dark/light/system) → forge is the new default
        setThemeState('forge');
      }
      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
    });
  }, []);

  // Apply theme class to document element
  useEffect(() => {
    document.documentElement.classList.remove('theme-forge', 'theme-clean');
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme]);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    window.electronAPI.preferences.update({ theme: t });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'forge' ? 'clean' : 'forge');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, loaded }}>
      {children}
    </ThemeContext.Provider>
  );
}
