"use client";

import { useEffect, useRef, useCallback } from "react";

type RenderCallback = (timestamp: number) => void;

export function useCockpitAnimation() {
  const callbacks = useRef<Map<string, RenderCallback>>(new Map());
  const animRef = useRef<number>(0);

  const register = useCallback((id: string, cb: RenderCallback) => {
    callbacks.current.set(id, cb);
  }, []);

  const unregister = useCallback((id: string) => {
    callbacks.current.delete(id);
  }, []);

  useEffect(() => {
    const animate = (ts: number) => {
      for (const [id, cb] of callbacks.current) {
        try {
          cb(ts);
        } catch (e) {
          console.warn(`[cockpit] render error in "${id}":`, e);
        }
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return { register, unregister };
}
