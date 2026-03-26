"use client";

import { useEffect, useRef } from "react";

interface GlowPoint {
  x: number;
  y: number;
  opacity: number;
  radius: number;
}

export function MouseGlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<GlowPoint[]>([]);
  const posRef = useRef({ x: -200, y: -200 });
  const animRef = useRef<number>(0);
  const activeRef = useRef(false);
  const mainOpacityRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let lastX = -200;
    let lastY = -200;

    // Fade rate: ~1 second at 60fps → 1/60 ≈ 0.017 per frame
    const FADE_IN_RATE = 0.08;
    const FADE_OUT_RATE = 0.017;

    const handleMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      posRef.current = { x, y };
      activeRef.current = true;

      const dx = x - lastX;
      const dy = y - lastY;
      if (dx * dx + dy * dy > 16) {
        pointsRef.current.push({
          x,
          y,
          opacity: 0.9,
          radius: 50,
        });
        lastX = x;
        lastY = y;
        if (pointsRef.current.length > 40) {
          pointsRef.current.shift();
        }
      }
    };

    const handleLeave = () => {
      activeRef.current = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      posRef.current = { x: t.clientX, y: t.clientY };
      activeRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      handleMove({ clientX: t.clientX, clientY: t.clientY } as MouseEvent);
    };

    const handleTouchEnd = () => {
      activeRef.current = false;
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fade main opacity in/out
      if (activeRef.current) {
        mainOpacityRef.current = Math.min(1, mainOpacityRef.current + FADE_IN_RATE);
      } else {
        mainOpacityRef.current = Math.max(0, mainOpacityRef.current - FADE_OUT_RATE);
      }

      const mainAlpha = mainOpacityRef.current;

      // Draw trail points (oldest first so newest renders on top)
      for (let i = 0; i < pointsRef.current.length; i++) {
        const p = pointsRef.current[i];
        const gradient = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, p.radius
        );
        gradient.addColorStop(0, `rgba(139, 92, 246, ${p.opacity})`);
        gradient.addColorStop(0.4, `rgba(139, 92, 246, ${p.opacity * 0.4})`);
        gradient.addColorStop(1, "rgba(139, 92, 246, 0)");

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Fade trail faster when inactive
        p.opacity -= activeRef.current ? 0.018 : 0.035;
        p.radius += 0.5;
      }

      pointsRef.current = pointsRef.current.filter((p) => p.opacity > 0);

      // Draw main glow at cursor position (fades with mainAlpha)
      if (mainAlpha > 0) {
        const { x, y } = posRef.current;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 80);
        g.addColorStop(0, `rgba(167, 139, 250, ${0.7 * mainAlpha})`);
        g.addColorStop(0.3, `rgba(139, 92, 246, ${0.35 * mainAlpha})`);
        g.addColorStop(0.6, `rgba(139, 92, 246, ${0.1 * mainAlpha})`);
        g.addColorStop(1, "rgba(139, 92, 246, 0)");
        ctx.beginPath();
        ctx.arc(x, y, 80, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10"
    />
  );
}
