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

    const handleMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      posRef.current = { x, y };

      // Only add trail points when mouse has moved enough
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
    document.addEventListener("mousemove", handleMove);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

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

        p.opacity -= 0.018;
        p.radius += 0.5;
      }

      pointsRef.current = pointsRef.current.filter((p) => p.opacity > 0);

      // Draw bright main glow at cursor position
      const { x, y } = posRef.current;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 80);
      g.addColorStop(0, "rgba(167, 139, 250, 0.7)");
      g.addColorStop(0.3, "rgba(139, 92, 246, 0.35)");
      g.addColorStop(0.6, "rgba(139, 92, 246, 0.1)");
      g.addColorStop(1, "rgba(139, 92, 246, 0)");
      ctx.beginPath();
      ctx.arc(x, y, 80, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("mousemove", handleMove);
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
