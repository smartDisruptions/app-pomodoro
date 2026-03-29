"use client";

import { useEffect, useRef } from "react";
import { useCanvas } from "@/hooks/use-canvas";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
}

interface ParticleFieldProps {
  elapsed: number; // 0 = just started, 1 = session complete
  isBreak: boolean;
  color: string; // CSS color string like "110, 70, 210"
  register: (id: string, cb: (ts: number) => void) => void;
  unregister: (id: string) => void;
  positioning?: "fixed" | "absolute";
}

const MIN_PARTICLES = 30;
const MAX_PARTICLES = 80;
const MIN_SPEED = 0.2;
const MAX_SPEED = 1.5;
const PARTICLE_SIZE = 1.5;
const BREAK_COUNT_RATIO = 0.4;
const BREAK_SPEED_RATIO = 0.2;

export function ParticleField({ elapsed, color, isBreak, register, unregister, positioning = "fixed" }: ParticleFieldProps) {
  const { canvasRef, ctxRef, sizeRef } = useCanvas();
  const particlesRef = useRef<Particle[]>([]);
  const elapsedRef = useRef(elapsed);
  const isBreakRef = useRef(isBreak);
  const colorRef = useRef(color);

  elapsedRef.current = elapsed;
  isBreakRef.current = isBreak;
  colorRef.current = color;

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    // Initialize particles
    const initCount = MIN_PARTICLES;
    particlesRef.current = Array.from({ length: initCount }, () =>
      createParticle(sizeRef.current.width, sizeRef.current.height)
    );

    const render = () => {
      const { width, height } = sizeRef.current;
      if (width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);

      const e = elapsedRef.current;
      const brk = isBreakRef.current;
      const col = colorRef.current;

      // Target count based on elapsed and break state
      const baseCount = Math.round(MIN_PARTICLES + (MAX_PARTICLES - MIN_PARTICLES) * e);
      const targetCount = brk ? Math.round(baseCount * BREAK_COUNT_RATIO) : baseCount;

      // Speed factor
      const baseSpeed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * e;
      const speedFactor = brk ? baseSpeed * BREAK_SPEED_RATIO : baseSpeed;

      const particles = particlesRef.current;

      // Add or remove particles to match target
      while (particles.length < targetCount) {
        particles.push(createParticle(width, height));
      }
      while (particles.length > targetCount) {
        particles.pop();
      }

      // Update and draw
      for (const p of particles) {
        p.x += p.vx * speedFactor;
        p.y += p.vy * speedFactor;

        // Wrap around edges
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        // Draw particle with glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col}, ${p.alpha * 0.6})`;
        ctx.fill();

        // Glow halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col}, ${p.alpha * 0.08})`;
        ctx.fill();
      }
    };

    register("particle-field", render);
    return () => unregister("particle-field");
  }, [register, unregister]);

  return (
    <canvas
      ref={canvasRef}
      className={`${positioning} inset-0 pointer-events-none`}
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}

function createParticle(w: number, h: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.3 + Math.random() * 0.7;
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    alpha: 0.2 + Math.random() * 0.5,
    size: PARTICLE_SIZE * (0.6 + Math.random() * 0.8),
  };
}
