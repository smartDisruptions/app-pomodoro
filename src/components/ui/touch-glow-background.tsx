"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { playTouchGlowSound } from "@/lib/audio";

export function TouchGlowBackground() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const activeRef = useRef(false);
  const opacityRef = useRef(0);
  const rafRef = useRef<number>(0);
  const soundPlayedRef = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Smooth exponential fade toward target opacity
    const target = activeRef.current ? 1 : 0;
    const speed = activeRef.current ? 0.12 : 0.05;
    opacityRef.current += (target - opacityRef.current) * speed;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const alpha = opacityRef.current;
    if (alpha > 0.005) {
      const { x, y } = posRef.current;

      // Outer diffuse halo
      const outer = ctx.createRadialGradient(x, y, 0, x, y, 200);
      outer.addColorStop(0, `rgba(124, 92, 252, ${0.28 * alpha})`);
      outer.addColorStop(0.45, `rgba(100, 70, 230, ${0.1 * alpha})`);
      outer.addColorStop(1, "rgba(80, 50, 200, 0)");
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(x, y, 200, 0, Math.PI * 2);
      ctx.fill();

      // Mid soft bloom
      const mid = ctx.createRadialGradient(x, y, 0, x, y, 72);
      mid.addColorStop(0, `rgba(170, 140, 255, ${0.55 * alpha})`);
      mid.addColorStop(0.6, `rgba(130, 100, 252, ${0.2 * alpha})`);
      mid.addColorStop(1, "rgba(100, 70, 220, 0)");
      ctx.fillStyle = mid;
      ctx.beginPath();
      ctx.arc(x, y, 72, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright core
      const inner = ctx.createRadialGradient(x, y, 0, x, y, 18);
      inner.addColorStop(0, `rgba(235, 225, 255, ${0.95 * alpha})`);
      inner.addColorStop(0.5, `rgba(190, 165, 255, ${0.6 * alpha})`);
      inner.addColorStop(1, "rgba(140, 110, 252, 0)");
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(draw);

    const onStart = (x: number, y: number) => {
      posRef.current = { x, y };
      activeRef.current = true;
      if (!soundPlayedRef.current && soundEnabledRef.current) {
        playTouchGlowSound();
        soundPlayedRef.current = true;
      }
    };

    const onMove = (x: number, y: number) => {
      posRef.current = { x, y };
    };

    const onEnd = () => {
      activeRef.current = false;
      soundPlayedRef.current = false;
    };

    const onMouseDown = (e: MouseEvent) => onStart(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => {
      if (e.buttons > 0) onMove(e.clientX, e.clientY);
    };
    const onMouseUp = () => onEnd();

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => onEnd();

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [draw]);

  return (
    <div ref={containerRef} className="fixed inset-0 -z-10 touch-none">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />
    </div>
  );
}
