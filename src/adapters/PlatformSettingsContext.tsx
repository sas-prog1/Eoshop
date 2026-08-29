import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUiAdapters } from "./UiAdaptersContext";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "../services/platformSettingsApi";
import { readableForeground } from "../utils/readableForeground";

interface PlatformSettingsState {
  settings: PlatformSettings;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  replace: (settings: PlatformSettings) => void;
}

const fallbackState: PlatformSettingsState = {
  settings: DEFAULT_PLATFORM_SETTINGS,
  loading: false,
  error: null,
  reload: async () => undefined,
  replace: () => undefined,
};

const PlatformSettingsContext = createContext<PlatformSettingsState>(fallbackState);

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const { platformSettings } = useUiAdapters();
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  const reload = useCallback(async () => {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    const currentGeneration = ++generation.current;
    if (mounted.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await platformSettings.load(nextController.signal);
      if (mounted.current && currentGeneration === generation.current && !nextController.signal.aborted) setSettings(next);
    } catch (caught) {
      if (mounted.current && currentGeneration === generation.current && !nextController.signal.aborted) {
        setSettings(DEFAULT_PLATFORM_SETTINGS);
        setError(caught instanceof Error ? caught.message : "تعذر تحميل هوية المنصة؛ تُستخدم القيم الآمنة الافتراضية.");
      }
    } finally {
      if (mounted.current && currentGeneration === generation.current) setLoading(false);
    }
  }, [platformSettings]);

  const replace = useCallback((next: PlatformSettings) => {
    controller.current?.abort();
    generation.current += 1;
    setSettings(next);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
      generation.current += 1;
      controller.current?.abort();
    };
  }, [reload]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--platform-primary", settings.primaryColor);
    root.style.setProperty("--platform-primary-foreground", readableForeground(settings.primaryColor));
    root.style.setProperty("--platform-brand-primary", settings.brandPrimaryColor);
    root.style.setProperty("--platform-brand-primary-foreground", readableForeground(settings.brandPrimaryColor));
    root.style.setProperty("--platform-brand-accent", settings.brandAccentColor);
    root.style.setProperty("--platform-brand-accent-foreground", readableForeground(settings.brandAccentColor));
    root.style.setProperty("--platform-brand-surface", settings.brandSurfaceColor);
    root.style.setProperty("--platform-brand-surface-foreground", readableForeground(settings.brandSurfaceColor));
    root.style.setProperty("--platform-brand-font", `"${settings.brandFontFamily}", "Cairo", sans-serif`);
  }, [settings]);

  const value = useMemo(() => ({ settings, loading, error, reload, replace }), [error, loading, reload, replace, settings]);
  return <PlatformSettingsContext.Provider value={value}>{children}</PlatformSettingsContext.Provider>;
}

export function usePlatformSettings(): PlatformSettingsState {
  return useContext(PlatformSettingsContext);
}
