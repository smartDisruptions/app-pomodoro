"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settings-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light", "premium");
    root.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
}
