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
  const mouseRef = useRef({ x: -100, y: -100 });
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

    const handleMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      pointsRef.current.push({
        x: e.clientX,
        y: e.clientY,
        opacity: 0.6,
        radius: 40,
      });
      // Cap trail length
      if (pointsRef.current.length > 30) {
        pointsRef.current.shift();
      }
    };
    window.addEventListener("mousemove", handleMove);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw trail points
      for (let i = pointsRef.current.length - 1; i >= 0; i--) {
        const p = pointsRef.current[i];
        const gradient = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, p.radius
        );
        gradient.addColorStop(0, `rgba(139, 92, 246, ${p.opacity})`);
        gradient.addColorStop(0.5, `rgba(139, 92, 246, ${p.opacity * 0.3})`);
        gradient.addColorStop(1, "rgba(139, 92, 246, 0)");

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Fade out
        p.opacity -= 0.015;
        p.radius += 0.3;
      }

      // Remove fully faded points
      pointsRef.current = pointsRef.current.filter((p) => p.opacity > 0);

      // Draw main glow at cursor
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mainGradient = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
      mainGradient.addColorStop(0, "rgba(139, 92, 246, 0.35)");
      mainGradient.addColorStop(0.4, "rgba(139, 92, 246, 0.12)");
      mainGradient.addColorStop(1, "rgba(139, 92, 246, 0)");
      ctx.beginPath();
      ctx.arc(mx, my, 60, 0, Math.PI * 2);
      ctx.fillStyle = mainGradient;
      ctx.fill();

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMove);
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
