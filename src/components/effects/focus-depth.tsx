"use client";

import { useEffect, useRef, useState } from "react";

interface FocusDepthProps {
  isRunning: boolean;
  isPaused: boolean;
  color: string; // CSS color
}

export function FocusDepth({ isRunning, isPaused, color }: FocusDepthProps) {
  const [depth, setDepth] = useState(0); // 0 to 1
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    if (!isRunning || isPaused) {
      setDepth(0);
      lastTickRef.current = 0;
      return;
    }

    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastTickRef.current) / 1000;
      // Full depth reached after 20 minutes of uninterrupted focus
      const maxSeconds = 20 * 60;
      setDepth((d) => Math.min(1, d + elapsed / maxSeconds));
      lastTickRef.current = now;
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  return (
    <div
      className="absolute bottom-0 left-0 right-0"
      style={{ zIndex: 30, height: "2px" }}
      aria-hidden="true"
    >
      <div
        style={{
          height: "100%",
          width: `${depth * 100}%`,
          background: color,
          opacity: 0.8,
          transition: "width 1s linear",
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </div>
  );
}
