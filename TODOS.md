# TODOS

## Audio layer for cockpit
- **What:** Generative sci-fi ambient hum that shifts tone with session progress via Web Audio API
- **Why:** Completes the sensory deep work cockpit experience (visual + audio)
- **Effort:** M (CC: ~30 min)
- **Priority:** P2
- **Depends on:** Living Cockpit visual foundation shipping first
- **Context:** Approach C from the office-hours design doc was deferred in favor of visuals-first. Existing lib/audio.ts has ambient sound infrastructure to build on. Browser autoplay policies will need handling.

## Session constellation gallery page
- **What:** New /gallery route displaying captured constellation screenshots as a grid of focus art
- **Why:** Turns ephemeral session art into a collectible, shareable gallery
- **Effort:** S (CC: ~15 min)
- **Priority:** P3
- **Depends on:** Screenshot capture feature (Phase 2 cherry-pick) shipping first
- **Context:** Screenshots stored as data URLs in session-store. Gallery is a read-only display of those images.

## Clean up leftover worktree
- **What:** Delete `.claude/worktrees/nice-mahavira/` directory (stale build cache)
- **Why:** Dead weight in the repo, clutters search results
- **Effort:** Trivial
- **Priority:** P3
- **Depends on:** Nothing
