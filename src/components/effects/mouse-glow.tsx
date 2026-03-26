"use client";

import { useEffect, useRef } from "react";

interface TrailPoint {
  x: number;
  y: number;
  age: number; // 0 = newest, increases each frame
}

export function MouseGlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<TrailPoint[]>([]);
  const posRef = useRef({ x: -200, y: -200 });
  const animRef = useRef<number>(0);
  const pressedRef = useRef(false);

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

    const MAX_TRAIL = 80;
    const MAX_AGE = 60; // frames to fully fade (~1s at 60fps)
    const HEAD_WIDTH = 6;
    const TAIL_MIN = 0.5;

    const addPoint = (x: number, y: number) => {
      posRef.current = { x, y };
      const trail = trailRef.current;
      const last = trail[trail.length - 1];
      // Add point only if moved enough for smoothness
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        if (dx * dx + dy * dy < 4) return;
      }
      trail.push({ x, y, age: 0 });
      if (trail.length > MAX_TRAIL) trail.shift();
    };

    const handleMouseDown = (e: MouseEvent) => {
      pressedRef.current = true;
      trailRef.current = [];
      addPoint(e.clientX, e.clientY);
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!pressedRef.current) return;
      addPoint(e.clientX, e.clientY);
    };
    const handleMouseUp = () => {
      pressedRef.current = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      pressedRef.current = true;
      trailRef.current = [];
      const t = e.touches[0];
      addPoint(t.clientX, t.clientY);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!pressedRef.current) return;
      const t = e.touches[0];
      addPoint(t.clientX, t.clientY);
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

    // Easing: smooth cubic fade
    const ease = (t: number) => t * t * (3 - 2 * t);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const trail = trailRef.current;

      if (trail.length >= 2) {
        // Draw the trail as a series of tapered line segments
        for (let i = 1; i < trail.length; i++) {
          const prev = trail[i - 1];
          const curr = trail[i];

          // Position along trail: 0 = tail (oldest), 1 = head (newest)
          const tPrev = i > 1 ? (i - 1) / (trail.length - 1) : 0;
          const tCurr = i / (trail.length - 1);

          // Age-based fade for each point
          const prevFade = Math.max(0, 1 - prev.age / MAX_AGE);
          const currFade = Math.max(0, 1 - curr.age / MAX_AGE);

          // Combine position taper with age fade
          const prevAlpha = ease(tPrev) * ease(prevFade);
          const currAlpha = ease(tCurr) * ease(currFade);

          // Skip fully transparent segments
          if (prevAlpha <= 0 && currAlpha <= 0) continue;

          // Width tapers from tail to head
          const prevWidth = TAIL_MIN + (HEAD_WIDTH - TAIL_MIN) * ease(tPrev) * ease(prevFade);
          const currWidth = TAIL_MIN + (HEAD_WIDTH - TAIL_MIN) * ease(tCurr) * ease(currFade);

          // Draw tapered segment using a quadrilateral
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) continue;

          const nx = -dy / len;
          const ny = dx / len;

          // Create gradient along segment
          const avgAlpha = (prevAlpha + currAlpha) / 2;
          const color = `rgba(110, 70, 210, ${avgAlpha * 0.7})`;

          ctx.beginPath();
          ctx.moveTo(prev.x + nx * prevWidth, prev.y + ny * prevWidth);
          ctx.lineTo(curr.x + nx * currWidth, curr.y + ny * currWidth);
          ctx.lineTo(curr.x - nx * currWidth, curr.y - ny * currWidth);
          ctx.lineTo(prev.x - nx * prevWidth, prev.y - ny * prevWidth);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        }

        // Outer glow pass — thicker, more transparent, for the glow effect
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 1; i < trail.length; i++) {
          const prev = trail[i - 1];
          const curr = trail[i];
          const tCurr = i / (trail.length - 1);
          const currFade = Math.max(0, 1 - curr.age / MAX_AGE);
          const alpha = ease(tCurr) * ease(currFade);
          if (alpha <= 0) continue;

          const glowWidth = (TAIL_MIN + (HEAD_WIDTH * 3 - TAIL_MIN) * ease(tCurr)) * ease(currFade);

          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.strokeStyle = `rgba(110, 70, 210, ${alpha * 0.15})`;
          ctx.lineWidth = glowWidth;
          ctx.stroke();
        }

        // Small bright dot at the head when pressed
        if (pressedRef.current && trail.length > 0) {
          const head = trail[trail.length - 1];
          const headFade = Math.max(0, 1 - head.age / MAX_AGE);
          if (headFade > 0) {
            const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 14);
            g.addColorStop(0, `rgba(160, 130, 255, ${0.6 * headFade})`);
            g.addColorStop(0.5, `rgba(110, 70, 210, ${0.2 * headFade})`);
            g.addColorStop(1, "rgba(110, 70, 210, 0)");
            ctx.beginPath();
            ctx.arc(head.x, head.y, 14, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
          }
        }
      }

      // Age all points (faster when not pressed for smooth fade-away)
      const ageRate = pressedRef.current ? 0.6 : 2.5;
      for (const p of trail) {
        p.age += ageRate;
      }
      // Remove fully faded points
      trailRef.current = trail.filter((p) => p.age < MAX_AGE);

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
