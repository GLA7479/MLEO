// components/SettingsContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const SettingsContext = createContext(null);
const KEY = "mleo_settings_v1";

const DEFAULTS = { master: true, music: true, sfx: true, haptics: true };

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  // Load once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  // Save + broadcast to the global guard
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {}
    // פרסום אירוע גלובלי
    try {
      window.dispatchEvent(new CustomEvent("mleo:settings", { detail: settings }));
    } catch {}
  }, [settings]);

  const value = useMemo(() => ({
    settings,
    set: (patch) => setSettings((s) => ({ ...s, ...patch })),
    toggle: (k) => setSettings((s) => ({ ...s, [k]: !s[k] })),
    reset: () => setSettings(DEFAULTS),
  }), [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
