# Design System — Pomodoro Timer

## Product Context
- **What this is:** A pomodoro timer with an immersive "Deep Work Cockpit" fullscreen mode
- **Who it's for:** The builder who wants focus mode to feel like a mission, not a spa
- **Space/industry:** Productivity / focus timers
- **Project type:** Web app (Next.js 16.2, React 19, Tailwind v4)

## Aesthetic Direction
- **Direction:** Retro-Futuristic / Industrial
- **Decoration level:** Intentional — glow effects and particles ARE the decoration
- **Mood:** A well-worn spacecraft bridge. Intense but not cluttered. The timer is alive, not just counting down.

## Typography
- **Display/Timer:** Geist Sans — clean, geometric, slightly technical. 4.5rem for timer digits, -0.03em tracking
- **Body:** Geist Sans — consistent, no extra font loads needed
- **UI/Labels:** Geist Sans
- **HUD/Data:** Geist Mono — 11px, uppercase, 0.05em letter-spacing, weight 400. This is what gives the cockpit its sci-fi feel.
- **Code:** Geist Mono
- **Loading:** Both fonts ship with Next.js via `next/font`. No external CDN needed.
- **Scale:**
  - Timer display: 4.5rem (72px)
  - Page heading: 2rem (32px)
  - Section heading: 1.25rem (20px)
  - Body: 1rem (16px)
  - Small/caption: 0.875rem (14px)
  - HUD stats: 11px
  - HUD labels: 10px

## Color

### Approach: Balanced
Primary + semantic + 3 cockpit themes.

### Base Palette
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `hsl(225, 25%, 8%)` | Page background |
| `--surface` | `hsl(225, 20%, 12%)` | Cards, elevated surfaces |
| `--surface-elevated` | `hsl(225, 18%, 16%)` | Hover states, active surfaces |
| `--foreground` | `hsl(225, 15%, 95%)` | Primary text |
| `--muted` | `hsl(225, 10%, 55%)` | Secondary text, labels |
| `--border` | `hsl(225, 15%, 22%)` | Dividers, outlines |
| `--primary` | `hsl(252, 85%, 63%)` | Focus/work state, interactive elements |
| `--accent` | `hsl(38, 95%, 55%)` | Break state, warmth, warnings |
| `--primary-glow` | `hsl(252, 85%, 63% / 0.3)` | Ring glow, shadow effects |
| `--accent-glow` | `hsl(38, 95%, 55% / 0.25)` | Break mode glow |

### Semantic Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--success` / `--short-break` | `hsl(152, 70%, 45%)` | Completed sessions, short break |
| `--warning` | `hsl(38, 95%, 55%)` | Caution states |
| `--error` | `hsl(0, 75%, 55%)` | Destructive actions, errors |
| `--info` / `--long-break` | `hsl(210, 80%, 55%)` | Informational, long break |

### Cockpit Theme Tokens
Set on `.cockpit-container` via CSS custom properties. All canvas components read these.

| Token | Default (Purple) | Tron Blue | Matrix Green | Iron Man Gold |
|-------|-----------------|-----------|--------------|---------------|
| `--cockpit-primary` | `hsl(252, 85%, 63%)` | `hsl(195, 100%, 50%)` | `hsl(120, 100%, 40%)` | `hsl(45, 100%, 50%)` |
| `--cockpit-glow` | `hsl(252, 85%, 63% / 0.3)` | `hsl(195, 100%, 50% / 0.3)` | `hsl(120, 100%, 40% / 0.3)` | `hsl(45, 100%, 50% / 0.3)` |
| `--cockpit-particle` | `hsl(252, 70%, 70%)` | `hsl(195, 80%, 65%)` | `hsl(120, 70%, 55%)` | `hsl(45, 80%, 65%)` |
| `--cockpit-hud-text` | `hsl(252, 30%, 70%)` | `hsl(195, 30%, 70%)` | `hsl(120, 30%, 65%)` | `hsl(45, 30%, 70%)` |

Break mode override: swap `--cockpit-primary` to `--accent` (amber), `--cockpit-glow` to `--accent-glow`, `--cockpit-particle` to `hsl(38, 80%, 65%)`.

### Dark Mode
Default. The app is dark-first. The cockpit only works in dark mode.

### Light Mode
Exists for the main app (timer, stats, settings). Cockpit is always dark regardless of app theme.
Light mode surfaces: `--background: hsl(0, 0%, 100%)`, `--surface: hsl(220, 15%, 97%)`, primary saturation reduced ~5%.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable (main app), Compact (cockpit HUD elements)
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Hybrid — grid-disciplined for main app, creative/absolute for cockpit
- **Max content width:** 640px (main app pages)
- **Timer ring size:** 280px default, 320px in cockpit mode
- **Border radius:** sm(4px) md(8px) lg(10px) — from `--radius: 0.625rem`
- **Cockpit layout:** Fullscreen fixed, z-layered canvas stack (z-0 particles, z-10 glow, z-20 ring+timer, z-30 HUD, z-40 overlays, z-50 exit button)

## Motion
- **Approach:** Intentional
- **Easing:**
  - Spring: `cubic-bezier(0.34, 1.56, 0.64, 1)` — interactive feedback, button press
  - Enter: `ease-out` — elements appearing
  - Exit: `ease-in` — elements leaving
  - Move: `ease-in-out` — transitions, state changes
- **Duration tokens:**
  - `--duration-fast`: 150ms — hover, focus, micro-interactions
  - `--duration-normal`: 300ms — state transitions, fade-in
  - `--duration-slow`: 500ms — complex transitions
  - `--duration-slower`: 800ms — dramatic transitions
- **Cockpit-specific:**
  - Particle drift: continuous (requestAnimationFrame)
  - Ring pulse (last 5 min): 2s cycle, ease-in-out
  - HUD fade-in: 2-3s delay, 500ms ease-out
  - Break color transition: ~1.5s ease-in-out
  - Session ceremony: 0.5s bright flash + 1s fade
  - Keyboard overlay: 3s visible, fade-out 300ms

## Cockpit Visual Specs
- **Particles:** 1.5px circles with slight glow, 30-80 count based on session progress
- **Constellation:** Same color as active trail at alpha 0.08, max 500 points
- **Focus depth bar:** 2px tall, bottom of screen, full width, fills left to right
- **HUD text:** Geist Mono, 11px, uppercase, 0.05em tracking, opacity 0.6
- **Mobile cockpit:** HUD stats hidden by default, tap to peek for 3 seconds

## Accessibility
- `prefers-reduced-motion`: particles disabled, ceremony skipped, ring shows static progress
- Keyboard shortcuts: Space (start/pause), Escape (exit fullscreen), ? (show shortcuts)
- Canvas elements: `aria-hidden="true"` (decorative only, timer display handles a11y)
- Touch targets: 44px minimum for exit button
- Color contrast: HUD text at 0.6 opacity on dark background meets WCAG AA (6.5:1)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-28 | Initial design system created | Codified existing CSS tokens + cockpit theme specs from /design-consultation |
| 2026-03-28 | Geist Sans/Mono as sole font family | Already loaded via Next.js, monospace gives cockpit its sci-fi feel |
| 2026-03-28 | 4 cockpit themes (Purple, Tron, Matrix, Gold) | Personalization via CSS custom properties, minimal code overhead |
| 2026-03-28 | Mobile cockpit: hide HUD, tap to peek | Cleaner experience on small screens, touch is natural for peek |
| 2026-03-28 | Cockpit always dark regardless of app theme | Canvas glow effects require dark background to work visually |
