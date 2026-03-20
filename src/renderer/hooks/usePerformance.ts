import { useState, useEffect, useRef, useCallback } from 'react';
import { useAPI } from './useAPI';

// --- WSL Detection (cached) ---

let _isWSL: boolean | null = null;

export function useIsWSL(): boolean {
  const api = useAPI();
  const [isWSL, setIsWSL] = useState(_isWSL ?? false);

  useEffect(() => {
    if (_isWSL !== null) return;
    api.system.getEnvironment().then((env) => {
      _isWSL = env.platform === 'wsl';
      setIsWSL(_isWSL);
    }).catch(() => {
      _isWSL = false;
    });
  }, [api]);

  return isWSL;
}

// --- Reduce Motion Detection ---

let _reduceMotion: boolean | null = null;

export function useReduceMotion(): boolean {
  const api = useAPI();
  const [reduce, setReduce] = useState(() => {
    if (_reduceMotion !== null) return _reduceMotion;
    // Also check OS preference
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  });

  useEffect(() => {
    api.preferences.get().then((prefs) => {
      _reduceMotion = prefs.reduceAnimations ?? false;
      if (_reduceMotion) setReduce(true);
    }).catch(() => { /* preferences unavailable */ });
  }, [api]);

  // Listen for OS preference changes
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setReduce(true);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduce;
}

// --- Should reduce visual effects (WSL or reduceMotion) ---

export function useLightMode(): boolean {
  const isWSL = useIsWSL();
  const reduceMotion = useReduceMotion();
  return isWSL || reduceMotion;
}

// --- IPC Response Cache ---

const ipcCache = new Map<string, { data: unknown; timestamp: number }>();

export function useCachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttlMs: number,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(() => {
    const cached = ipcCache.get(key);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.data as T;
    }
    return null;
  });
  const [loading, setLoading] = useState(data === null);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(queryFn);
  fnRef.current = queryFn;

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      ipcCache.set(key, { data: result, timestamp: Date.now() });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  useEffect(() => {
    // If we have cached data, skip initial fetch
    const cached = ipcCache.get(key);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      setData(cached.data as T);
      setLoading(false);
      return;
    }
    execute();
  }, [execute, key, ttlMs]);

  return { data, loading, error, refetch: execute };
}

export function invalidateCache(key: string): void {
  ipcCache.delete(key);
}

// --- Deferred initialization ---

export function useDeferredInit(delayMs: number, callback: () => void): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const timer = setTimeout(() => callbackRef.current(), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
}

// --- Visibility-aware interval ---

export function useVisibleInterval(callback: () => void, intervalMs: number): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => callbackRef.current(), intervalMs);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function handleVisibility() {
      if (document.hidden) {
        stop();
      } else {
        start();
        // Refresh immediately when becoming visible
        callbackRef.current();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs]);
}
