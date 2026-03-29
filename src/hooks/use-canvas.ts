"use client";

import { useEffect, useRef } from "react";

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      sizeRef.current = { width: canvas.width, height: canvas.height };
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return { canvasRef, ctxRef, sizeRef };
}
