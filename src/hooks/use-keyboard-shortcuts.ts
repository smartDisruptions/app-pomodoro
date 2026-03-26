"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onToggle: () => void;
  onSkip: () => void;
  onReset: () => void;
}

export function useKeyboardShortcuts({
  onToggle,
  onSkip,
  onReset,
}: ShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          onToggle();
          break;
        case "KeyS":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            onSkip();
          }
          break;
        case "KeyR":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            onReset();
          }
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onToggle, onSkip, onReset]);
}
