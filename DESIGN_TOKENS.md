# Pomodoro Timer — Design System Tokens

## Color Palette

### Base (Dark-First)
```
background:       hsl(225, 25%, 8%)       -- #101318
surface:          hsl(225, 20%, 12%)      -- #171B24
surface-elevated: hsl(225, 18%, 16%)      -- #212632
border:           hsl(225, 15%, 22%)      -- #2E3340
border-hover:     hsl(225, 15%, 30%)      -- #3F4455
```

### Text
```
foreground:       hsl(225, 15%, 95%)      -- #F0F1F4
foreground-muted: hsl(225, 10%, 55%)      -- #848994
foreground-subtle:hsl(225, 8%, 40%)       -- #5F636E
```

### Primary (Indigo-Violet)
```
primary:          hsl(252, 85%, 63%)      -- #7C5CFC
primary-hover:    hsl(252, 85%, 70%)      -- #9479FD
primary-glow:     hsl(252, 85%, 63%, 0.3) -- glow overlay
primary-muted:    hsl(252, 40%, 20%)      -- #2A2040
```

### Accent (Amber-Gold for premium)
```
accent:           hsl(38, 95%, 55%)       -- #F0A820
accent-hover:     hsl(38, 95%, 65%)       -- #F4BC4A
accent-muted:     hsl(38, 50%, 18%)       -- #352C15
```

### Semantic
```
success:          hsl(152, 70%, 45%)      -- #22B86A
warning:          hsl(38, 95%, 55%)       -- #F0A820
destructive:      hsl(0, 75%, 55%)        -- #D94040
info:             hsl(210, 80%, 55%)      -- #3B8EE6
```

### Focus/Break State Colors
```
focus-color:      hsl(252, 85%, 63%)      -- primary (indigo)
short-break:      hsl(152, 70%, 45%)      -- success (green)
long-break:       hsl(210, 80%, 55%)      -- info (blue)
```

## Typography

```
font-family:       "Inter", system-ui, -apple-system, sans-serif
font-mono:         "JetBrains Mono", "SF Mono", monospace

font-size-xs:      0.75rem   (12px)
font-size-sm:      0.875rem  (14px)
font-size-base:    1rem      (16px)
font-size-lg:      1.125rem  (18px)
font-size-xl:      1.25rem   (20px)
font-size-2xl:     1.5rem    (24px)
font-size-3xl:     1.875rem  (30px)
font-size-4xl:     2.25rem   (36px)
font-size-timer:   4.5rem    (72px)  -- main timer display

font-weight-normal:  400
font-weight-medium:  500
font-weight-semibold:600
font-weight-bold:    700

line-height-tight:   1.25
line-height-normal:  1.5
line-height-relaxed: 1.75
```

## Spacing (4px base unit)

Standard Tailwind scale (4px increments). No custom overrides needed.

## Border Radius

```
radius-sm:    0.375rem  (6px)
radius-md:    0.5rem    (8px)
radius-lg:    0.75rem   (12px)
radius-xl:    1rem      (16px)
radius-full:  9999px
```

## Shadows

```
shadow-sm:    0 1px 2px hsl(225, 25%, 4%, 0.5)
shadow-md:    0 4px 12px hsl(225, 25%, 4%, 0.5)
shadow-lg:    0 8px 24px hsl(225, 25%, 4%, 0.6)
shadow-glow:  0 0 20px hsl(252, 85%, 63%, 0.3)   -- primary glow
shadow-glow-accent: 0 0 20px hsl(38, 95%, 55%, 0.25) -- accent glow
```

## Animation Durations

```
duration-fast:    150ms
duration-normal:  300ms
duration-slow:    500ms
duration-slower:  800ms

easing-default:   cubic-bezier(0.4, 0, 0.2, 1)
easing-spring:    cubic-bezier(0.34, 1.56, 0.64, 1)
```

## Light Theme Overrides

```
background:       hsl(0, 0%, 100%)
surface:          hsl(220, 15%, 97%)
surface-elevated: hsl(0, 0%, 100%)
border:           hsl(220, 15%, 88%)
foreground:       hsl(225, 25%, 12%)
foreground-muted: hsl(225, 10%, 45%)
```

## Premium Theme (Deep Cosmos)

```
background:       hsl(260, 30%, 6%)
surface:          hsl(260, 25%, 10%)
surface-elevated: hsl(260, 22%, 14%)
border:           hsl(260, 18%, 20%)
primary:          hsl(280, 80%, 65%)
accent:           hsl(38, 95%, 60%)
-- Gradient overlay: radial-gradient from primary-glow to transparent
```
