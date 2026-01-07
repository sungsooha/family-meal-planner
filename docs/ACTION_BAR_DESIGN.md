# Action Bar Design

## Goals
- Keep key actions reachable without a persistent, tall toolbar.
- Show minimal context (page title + status) at all times.
- Avoid scroll-driven hide/show logic that creates flicker.

## Design Pattern
### Main Pages (Plan / Recipes / Shopping)
- Use a compact sticky header row for context only.
- Provide a single **Actions** pill that opens a small dropdown panel.
- Actions live inside the panel to keep the header minimal.

### Detail Pages
- Use the sticky header as a true page header (title, metadata, back link).
- Provide a small **⋯** menu for secondary actions (e.g., Edit).

## Behavior
- Action panel opens on click and closes on:
  - outside click
  - Escape key
- No scroll-based auto-hide.

## Rationale
- The header stays stable and predictable.
- Actions are one click away but do not consume layout space when idle.
- Avoids bugs from scroll/state persistence.
