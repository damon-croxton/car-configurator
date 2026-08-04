import { useCallback, useEffect, useRef, useState } from 'react';
import type { CarConfig } from '../config/types';
import { reconcileConfig } from '../config/defaults';
import { readConfigFromUrl, syncUrl } from '../config/urlState';

/**
 * Single source of truth for the build.
 *
 * The initial state comes from the URL (so shared links restore exactly), every
 * change is reconciled against the catalogue, and the URL is kept in sync with
 * `replaceState` so the address bar is always a shareable link.
 */
export function useConfigurator() {
  const [config, setConfigState] = useState<CarConfig>(() => readConfigFromUrl());
  const history = useRef<CarConfig[]>([]);

  useEffect(() => {
    syncUrl(config);
  }, [config]);

  const setConfig = useCallback((update: Partial<CarConfig> | ((prev: CarConfig) => Partial<CarConfig>)) => {
    setConfigState((prev) => {
      const patch = typeof update === 'function' ? update(prev) : update;
      const next = reconcileConfig({ ...prev, ...patch });
      history.current.push(prev);
      if (history.current.length > 50) history.current.shift();
      return next;
    });
  }, []);

  const replaceConfig = useCallback((next: CarConfig) => {
    setConfigState((prev) => {
      history.current.push(prev);
      return reconcileConfig(next);
    });
  }, []);

  const undo = useCallback(() => {
    setConfigState((prev) => {
      const previous = history.current.pop();
      return previous ? reconcileConfig(previous) : prev;
    });
  }, []);

  const canUndo = history.current.length > 0;

  return { config, setConfig, replaceConfig, undo, canUndo };
}
