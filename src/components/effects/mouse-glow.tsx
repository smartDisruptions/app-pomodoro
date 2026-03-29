"use client";

import { useEffect, useRef } from "react";

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

interface ConstellationPoint {
  x: number;
  y: number;
}

interface MouseGlowProps {
  constellation?: boolean;
  color?: string; // RGB triplet like "110, 70, 210"
  glowColor?: string; // Brighter variant like "160, 130, 255"
  constellationRef?: React.MutableRefObject<ConstellationPoint[]>;
  register?: (id: string, cb: (ts: number) => void) => void;
  unregister?: (id: string) => void;
  positioning?: "fixed" | "absolute";
}

const MAX_TRAIL = 80;
const MAX_AGE = 60;
const HEAD_WIDTH = 6;
const TAIL_MIN = 0.5;
const CONSTELLATION_ALPHA = 0.08;
const MAX_CONSTELLATION = 500;

export function MouseGlow({
  constellation = false,
  color = "110, 70, 210",
  glowColor = "160, 130, 255",
  constellationRef,
  register,
  unregister,
  positioning = "fixed",
}: MouseGlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<TrailPoint[]>([]);
  const animRef = useRef<number>(0);
  const pressedRef = useRef(false);
  const colorRef = useRef(color);
  const glowColorRef = useRef(glowColor);
  const constellationModeRef = useRef(constellation);
  // Hidden canvas for persistent constellation marks
  const persistCanvasRef = useRef<HTMLCanvasElement | null>(null);

  colorRef.current = color;
  glowColorRef.current = glowColor;
  constellationModeRef.current = constellation;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Also resize persist canvas
      if (persistCanvasRef.current) {
        const old = persistCanvasRef.current;
        const oldCtx = old.getContext("2d");
        const imageData = oldCtx?.getImageData(0, 0, old.width, old.height);
        old.width = canvas.width;
        old.height = canvas.height;
        if (imageData && oldCtx) {
          oldCtx.putImageData(imageData, 0, 0);
        }
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // Create hidden canvas for constellation persistence
    try {
      const pc = document.createElement("canvas");
      pc.width = canvas.width;
      pc.height = canvas.height;
      persistCanvasRef.current = pc;

      // Restore constellation from parent ref if available
      if (constellationRef?.current.length) {
        const pctx = pc.getContext("2d");
        if (pctx) {
          for (const p of constellationRef.current) {
            pctx.beginPath();
            pctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            pctx.fillStyle = `rgba(${colorRef.current}, ${CONSTELLATION_ALPHA})`;
            pctx.fill();
          }
        }
      }
    } catch {
      // OOM fallback: no constellation persistence
      persistCanvasRef.current = null;
    }

    const addPoint = (x: number, y: number) => {
      const trail = trailRef.current;
      const last = trail[trail.length - 1];
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        if (dx * dx + dy * dy < 4) return;
      }
      trail.push({ x, y, age: 0 });
      if (trail.length > MAX_TRAIL) trail.shift();

      // Add to constellation
      if (constellationModeRef.current && constellationRef) {
        constellationRef.current.push({ x, y });
        if (constellationRef.current.length > MAX_CONSTELLATION) {
          constellationRef.current.shift();
        }
        // Draw persistent mark on hidden canvas
        const pctx = persistCanvasRef.current?.getContext("2d");
        if (pctx) {
          pctx.beginPath();
          pctx.arc(x, y, 2, 0, Math.PI * 2);
          pctx.fillStyle = `rgba(${colorRef.current}, ${CONSTELLATION_ALPHA})`;
          pctx.fill();
          // Glow mark
          pctx.beginPath();
          pctx.arc(x, y, 6, 0, Math.PI * 2);
          pctx.fillStyle = `rgba(${colorRef.current}, ${CONSTELLATION_ALPHA * 0.3})`;
          pctx.fill();
        }
      }
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
    const handleMouseUp = () => { pressedRef.current = false; };
    const handleTouchStart = (e: TouchEvent) => {
      pressedRef.current = true;
      trailRef.current = [];
      addPoint(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!pressedRef.current) return;
      addPoint(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleTouchEnd = () => { pressedRef.current = false; };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    const ease = (t: number) => t * t * (3 - 2 * t);

    const renderFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw persistent constellation layer
      if (persistCanvasRef.current && constellationModeRef.current) {
        ctx.drawImage(persistCanvasRef.current, 0, 0);
      }

      const trail = trailRef.current;
      const col = colorRef.current;
      const gCol = glowColorRef.current;

      if (trail.length >= 2) {
        // Tapered trail segments
        for (let i = 1; i < trail.length; i++) {
          const prev = trail[i - 1];
          const curr = trail[i];
          const tPrev = i > 1 ? (i - 1) / (trail.length - 1) : 0;
          const tCurr = i / (trail.length - 1);
          const prevFade = Math.max(0, 1 - prev.age / MAX_AGE);
          const currFade = Math.max(0, 1 - curr.age / MAX_AGE);
          const prevAlpha = ease(tPrev) * ease(prevFade);
          const currAlpha = ease(tCurr) * ease(currFade);
          if (prevAlpha <= 0 && currAlpha <= 0) continue;

          const prevWidth = TAIL_MIN + (HEAD_WIDTH - TAIL_MIN) * ease(tPrev) * ease(prevFade);
          const currWidth = TAIL_MIN + (HEAD_WIDTH - TAIL_MIN) * ease(tCurr) * ease(currFade);
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) continue;

          const nx = -dy / len;
          const ny = dx / len;
          const avgAlpha = (prevAlpha + currAlpha) / 2;

          ctx.beginPath();
          ctx.moveTo(prev.x + nx * prevWidth, prev.y + ny * prevWidth);
          ctx.lineTo(curr.x + nx * currWidth, curr.y + ny * currWidth);
          ctx.lineTo(curr.x - nx * currWidth, curr.y - ny * currWidth);
          ctx.lineTo(prev.x - nx * prevWidth, prev.y - ny * prevWidth);
          ctx.closePath();
          ctx.fillStyle = `rgba(${col}, ${avgAlpha * 0.7})`;
          ctx.fill();
        }

        // Outer glow pass
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
          ctx.strokeStyle = `rgba(${col}, ${alpha * 0.15})`;
          ctx.lineWidth = glowWidth;
          ctx.stroke();
        }

        // Head dot when pressed
        if (pressedRef.current && trail.length > 0) {
          const head = trail[trail.length - 1];
          const headFade = Math.max(0, 1 - head.age / MAX_AGE);
          if (headFade > 0) {
            const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 14);
            g.addColorStop(0, `rgba(${gCol}, ${0.6 * headFade})`);
            g.addColorStop(0.5, `rgba(${col}, ${0.2 * headFade})`);
            g.addColorStop(1, `rgba(${col}, 0)`);
            ctx.beginPath();
            ctx.arc(head.x, head.y, 14, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
          }
        }
      }

      // Age points
      const ageRate = pressedRef.current ? 0.6 : 2.5;
      for (const p of trail) p.age += ageRate;
      trailRef.current = trail.filter((p) => p.age < MAX_AGE);
    };

    // Use coordinator if provided, else standalone loop
    if (register && unregister) {
      register("mouse-glow", renderFrame);
    } else {
      const standalone = () => {
        renderFrame();
        animRef.current = requestAnimationFrame(standalone);
      };
      animRef.current = requestAnimationFrame(standalone);
    }

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      if (register && unregister) {
        unregister("mouse-glow");
      } else {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [register, unregister]);

  return (
    <canvas
      ref={canvasRef}
      className={`${positioning} inset-0 pointer-events-none`}
      style={{ zIndex: 10 }}
      aria-hidden="true"
    />
  );
}
