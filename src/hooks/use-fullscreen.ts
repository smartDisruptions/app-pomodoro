"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFullscreenStore } from "@/stores/fullscreen-store";

export function useFullscreen() {
  const isFullscreen = useFullscreenStore((s) => s.isFullscreen);
  const setFullscreen = useFullscreenStore((s) => s.setFullscreen);
  const cssOnlyRef = useRef(false);

  const enter = useCallback(() => {
    // Try the Fullscreen API but don't block on it
    let usedApi = false;
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // Fullscreen API denied — CSS-only fallback already active
        });
        usedApi = true;
      }
    } catch {
      // requestFullscreen not available
    }
    if (!usedApi) cssOnlyRef.current = true;
    setFullscreen(true);
  }, [setFullscreen]);

  const exit = useCallback(async () => {
    cssOnlyRef.current = false;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore errors
    }
    setFullscreen(false);
  }, [setFullscreen]);

  const toggle = useCallback(() => {
    if (isFullscreen) exit();
    else enter();
  }, [isFullscreen, enter, exit]);

  // Sync state when user exits fullscreen via browser UI (only when using real API)
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement && !cssOnlyRef.current) {
        setFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [setFullscreen]);

  // Escape key to exit focus mode (CSS-only case)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen && !document.fullscreenElement) {
        setFullscreen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isFullscreen, setFullscreen]);

  return { isFullscreen, toggle, enter, exit };
}
