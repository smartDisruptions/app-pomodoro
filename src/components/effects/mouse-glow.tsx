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
  const pressedRef = useRef(false);
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

    // 0.5s fade at 60fps → ~0.033 per frame
    const FADE_IN_RATE = 0.1;
    const FADE_OUT_RATE = 0.033;

    const addTrailPoint = (x: number, y: number) => {
      posRef.current = { x, y };
      const dx = x - lastX;
      const dy = y - lastY;
      if (dx * dx + dy * dy > 16) {
        pointsRef.current.push({
          x,
          y,
          opacity: 0.6,
          radius: 45,
        });
        lastX = x;
        lastY = y;
        if (pointsRef.current.length > 40) {
          pointsRef.current.shift();
        }
      }
    };

    // Mouse: only glow while clicking and dragging
    const handleMouseDown = (e: MouseEvent) => {
      pressedRef.current = true;
      posRef.current = { x: e.clientX, y: e.clientY };
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!pressedRef.current) return;
      addTrailPoint(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      pressedRef.current = false;
    };

    // Touch: glow while finger is on screen and moving
    const handleTouchStart = (e: TouchEvent) => {
      pressedRef.current = true;
      const t = e.touches[0];
      posRef.current = { x: t.clientX, y: t.clientY };
      lastX = t.clientX;
      lastY = t.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pressedRef.current) return;
      const t = e.touches[0];
      addTrailPoint(t.clientX, t.clientY);
    };

    const handleTouchEnd = () => {
      pressedRef.current = false;
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fade main opacity in/out
      if (pressedRef.current) {
        mainOpacityRef.current = Math.min(1, mainOpacityRef.current + FADE_IN_RATE);
      } else {
        mainOpacityRef.current = Math.max(0, mainOpacityRef.current - FADE_OUT_RATE);
      }

      const mainAlpha = mainOpacityRef.current;

      // Draw trail points
      for (let i = 0; i < pointsRef.current.length; i++) {
        const p = pointsRef.current[i];
        const gradient = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, p.radius
        );
        gradient.addColorStop(0, `rgba(99, 60, 196, ${p.opacity})`);
        gradient.addColorStop(0.4, `rgba(99, 60, 196, ${p.opacity * 0.35})`);
        gradient.addColorStop(1, "rgba(99, 60, 196, 0)");

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Fade trail: ~0.5s when released, normal when pressed
        p.opacity -= pressedRef.current ? 0.016 : 0.045;
        p.radius += 0.5;
      }

      pointsRef.current = pointsRef.current.filter((p) => p.opacity > 0);

      // Draw main glow at cursor/finger position
      if (mainAlpha > 0) {
        const { x, y } = posRef.current;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 70);
        g.addColorStop(0, `rgba(120, 80, 220, ${0.5 * mainAlpha})`);
        g.addColorStop(0.3, `rgba(99, 60, 196, ${0.25 * mainAlpha})`);
        g.addColorStop(0.6, `rgba(99, 60, 196, ${0.08 * mainAlpha})`);
        g.addColorStop(1, "rgba(99, 60, 196, 0)");
        ctx.beginPath();
        ctx.arc(x, y, 70, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
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
