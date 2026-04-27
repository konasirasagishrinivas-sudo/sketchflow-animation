## Goal
Make the app feel cleaner and smoother — softer easing, subtle entrance animations, and refined hover/active states — without changing any functionality or the existing ink-on-paper design language.

## Changes

### 1. Animation system upgrade — `tailwind.config.ts`
Add a small set of premium-feel keyframes and easings:
- `fade-in` / `fade-in-up` — switch to `cubic-bezier(0.22, 1, 0.36, 1)` (Apple-style ease-out) and slightly slower for smoothness.
- `scale-in` — same smooth easing, used for dialog content.
- `slide-in-right` — for list items appearing.
- `shimmer` — for skeleton/loading bars.
- New utility ease: `ease-smooth` so components can opt in.

### 2. Global polish — `src/index.css`
- Add `scroll-behavior: smooth` on `html`.
- Smooth default transition for interactive elements (`button, a, [role="button"]`) with the new easing — duration 200ms.
- Improve focus ring (slightly softer, animated).
- Add `.glass-card` utility (backdrop-blur + paper tint) for elevated surfaces.
- Add `.hover-lift` utility (translateY(-2px) + shadow) for cards.
- Refine custom scrollbar (rounded thumb, hover color change).

### 3. ExportDialog — `src/components/editor/ExportDialog.tsx`
- Format checkboxes: add `transition-all duration-200 ease-smooth`, subtle hover lift, animated check state.
- Progress section: wrap in `animate-fade-in`; add shimmer overlay on the progress bar while rendering.
- Result cards: each appears with `animate-fade-in-up` and a small staggered delay (`style={{ animationDelay: ... }}`); add `hover-lift` and smoother grab cursor feedback.
- "Download all" link gets `story-link`-style underline animation.
- Drag state: when `dragging`, card scales to `0.98` and rotates `-1deg` for tactile feel.

### 4. ImportDialog — `src/components/ImportDialog.tsx`
- File drop area: animated dashed border on hover, scale-in icon.
- Progress block: same fade-in + shimmer treatment as ExportDialog for consistency.
- Style radio cards: smoother selected-state transition.

### 5. Editor shell — `src/pages/Editor.tsx`
- Apply `animate-fade-in` to top-level panels on mount.
- Toolbar buttons: unify hover (subtle bg shift, no jump).

### 6. Home / nav — `src/pages/Home.tsx`, `src/components/NavLink.tsx`
- Project cards: `hover-lift` + smoother shadow transition.
- NavLinks: use the `story-link` underline animation.

## Out of scope
- No color/theme changes (ink-on-paper preserved).
- No layout restructuring.
- No new dependencies.
- No backend or AI logic touched.

## Result
Snappier, more refined feel — buttons, cards, dialogs, and lists glide instead of pop. Same UI, noticeably more polished.
