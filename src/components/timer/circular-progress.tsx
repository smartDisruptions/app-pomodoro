"use client";

interface CircularProgressProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
  cockpit?: boolean; // Enable HUD glow variant
  elapsed?: number; // 0-1, for pulse intensity in last 5 min
  glowColor?: string; // CSS color for cockpit glow
}

export function CircularProgress({
  progress,
  size = 280,
  strokeWidth = 8,
  className,
  children,
  cockpit = false,
  elapsed = 0,
  glowColor,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, progress)));

  // In cockpit mode, glow intensity increases with elapsed
  // Pulse animation activates in the last ~20% of the session (elapsed > 0.8)
  const isLastStretch = elapsed > 0.8;
  const glowIntensity = cockpit ? 6 + elapsed * 14 : 6;
  const glowStr = glowColor
    ? `drop-shadow(0 0 ${glowIntensity}px ${glowColor})`
    : `drop-shadow(0 0 ${glowIntensity}px var(--primary-glow))`;

  // Tick marks for cockpit HUD ring — drawn INWARD to avoid SVG clipping
  const tickCount = 60;
  const ticks = cockpit
    ? Array.from({ length: tickCount }, (_, i) => {
        const angle = (i / tickCount) * 360 - 90;
        const rad = (angle * Math.PI) / 180;
        const outerR = radius - strokeWidth / 2 - 2;
        const innerR = radius - strokeWidth / 2 - (i % 5 === 0 ? 12 : 7);
        return {
          x1: size / 2 + Math.cos(rad) * outerR,
          y1: size / 2 + Math.sin(rad) * outerR,
          x2: size / 2 + Math.cos(rad) * innerR,
          y2: size / 2 + Math.sin(rad) * innerR,
          major: i % 5 === 0,
        };
      })
    : [];

  return (
    <div
      className={className}
      style={{ width: size, height: size, position: "relative", overflow: "visible" }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rotate-[-90deg]"
        style={{ overflow: "visible" }}
      >
        {/* Cockpit tick marks */}
        {cockpit &&
          ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={glowColor || "var(--primary)"}
              strokeWidth={t.major ? 1.5 : 0.5}
              opacity={t.major ? 0.3 : 0.15}
            />
          ))}
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progress-gradient)"
          strokeWidth={cockpit ? strokeWidth + 2 : strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-[stroke-dashoffset] duration-300 ease-linear ${isLastStretch && cockpit ? "animate-pulse-glow" : ""}`}
          style={{
            filter: glowStr,
          }}
        />
        <defs>
          <linearGradient
            id="progress-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={glowColor || "var(--primary)"} />
            <stop offset="100%" stopColor={glowColor || "var(--ring)"} />
          </linearGradient>
        </defs>
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
