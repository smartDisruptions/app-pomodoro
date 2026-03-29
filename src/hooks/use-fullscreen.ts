"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cssOnlyRef = useRef(false);

  const enter = useCallback(async () => {
    let usedApi = false;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        usedApi = true;
      }
    } catch {
      // Fullscreen API not available or denied — fall back to CSS-only
    }
    if (!usedApi) cssOnlyRef.current = true;
    setIsFullscreen(true);
  }, []);

  const exit = useCallback(async () => {
    cssOnlyRef.current = false;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore errors
    }
    setIsFullscreen(false);
  }, []);

  const toggle = useCallback(() => {
    if (isFullscreen) exit();
    else enter();
  }, [isFullscreen, enter, exit]);

  // Sync state when user exits fullscreen via Escape (only when using real API)
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement && !cssOnlyRef.current) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Escape key to exit focus mode (CSS-only case)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  return { isFullscreen, toggle, enter, exit };
}
