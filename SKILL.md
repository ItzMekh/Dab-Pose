# Dabspeed — SKILL.md

> Inspired by Karpathy's llm-wiki: this file is a **living schema** maintained by LLM agents.
> New patterns, decisions, and lessons compound here over time.
> Agents MUST read this before touching any file.

---

## Project Identity

**Dabspeed** — browser-based pose detection speed game. User dabs as fast as possible after a green signal. Time measured in milliseconds. Leaderboard via Supabase.

Stack: Next.js 15 · React 19 · TypeScript · Tailwind v4 · MediaPipe Holistic · Supabase · Framer Motion · Playwright

---

## Core Principles

### 1. Lean First
- Zero re-renders unless UI must change: prefer `useRef` over `useState` for mutable game values
- No state for things that don't affect render (e.g. signal timestamp, frame counter)
- `requestAnimationFrame` for game loop — never `setInterval` for animation
- Lazy-load MediaPipe: WASM is ~10MB, must not block initial paint
- `performance.now()` for timing — never `Date.now()`

### 2. Strict State Machine
Every game state transition goes through `transition()` in `src/lib/game-state.ts`.
Invalid transitions silently return current state — never throw.

```
IDLE → COUNTDOWN → WAITING → SIGNAL → DETECTED → RESULT → IDLE
                                 └─────→ FALSE_START ───→ IDLE
```

### 3. Error Surfaces
Every error has an owner:
- Camera errors → `useCamera` hook
- Detection errors → `useDabDetector` hook  
- API errors → `src/lib/api.ts`
- React crashes → `ErrorBoundary` wraps `GameScreen`
- Browser compat → `useBrowserCompat` hook, checked before game starts

### 4. Consecutive-Frame Confirmation
Never confirm dab on a single frame. Require `DAB_CONFIRM_FRAMES = 3` consecutive positive frames.
Reset counter on any negative frame.

### 5. Cleanup Contract
Every component/hook that touches camera or MediaPipe MUST return a cleanup function.
Pattern:
```ts
useEffect(() => {
  // setup
  return () => { /* stop stream, close holistic, cancel rAF */ }
}, [])
```

---

## File Map

```
src/
  lib/
    game-state.ts     ← State machine (ALLOWED_TRANSITIONS + transition())
    dab-detector.ts   ← DabDetector class with frame confirmation
    mediapipe.ts      ← loadHolistic() with retry + timeout
    api.ts            ← fetchWithRetry() + submitScore() + getLeaderboard()
    supabase.ts       ← Supabase client factory
  hooks/
    useCamera.ts      ← Camera stream + error codes + stream-lost detection
    useFPS.ts         ← rAF-based FPS counter
    useBrowserCompat.ts ← WebAssembly + getUserMedia + performance.now check
  components/
    ErrorBoundary.tsx ← Class component, wraps GameScreen
    game/
      CameraFeed.tsx  ← useCamera + MediaPipe loop + canvas overlay
      GameScreen.tsx  ← Orchestrator, uses transition() for state changes
      GameTimer.tsx   ← Countdown via rAF, random signal delay
      ResultScreen.tsx← Rating + score submit with retry
    landing/
      LandingScreen.tsx
    leaderboard/
      Leaderboard.tsx
    ui/
      cn.ts
  types/
    index.ts          ← GameState, Score, GameResult, CameraError
  app/
    page.tsx          ← ErrorBoundary + compat gate
    layout.tsx
    globals.css
    api/
      score/route.ts  ← POST: validate + sanity bounds + Supabase insert
      leaderboard/route.ts ← GET: top 10
```

---

## Conventions

### TypeScript
- Strict mode. No `any` except `holisticRef` (MediaPipe types incomplete).
- Explicit return types on all exported functions.
- `interface` for props, `type` for unions.

### CSS
- Tailwind only. No inline styles. No CSS modules.
- Dark theme: `bg-[#0a0a0f]` base, `text-white/gray-*` for text.
- Neon accent: `purple-400/500/600`, secondary `cyan-400`.
- Glassmorphism: `bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl`.
- Animation: Framer Motion for entrance/exit. CSS `transition-colors` for state color changes.

### Error Messages (user-facing)
| Code | Message |
|---|---|
| `NotAllowedError` | "Camera access denied — click the camera icon in your browser bar" |
| `NotFoundError` | "No camera found — plug in a webcam and refresh" |
| `NotReadableError` | "Camera is busy — close other apps using your camera" |
| `stream-lost` | "Camera disconnected — check your webcam" |
| `load-timeout` | "Pose detection took too long to load — check your connection" |
| `not-supported` | "Your browser doesn't support this game — try Chrome or Edge" |

### Validation Rules
| Field | Rule |
|---|---|
| `username` | `/^[a-zA-Z0-9_\- ]{1,20}$/` |
| `time_ms` | `100 ≤ x ≤ 30000` (integer) |

### Dab Detection Thresholds
| Parameter | Value | Notes |
|---|---|---|
| `DAB_CONFIRM_FRAMES` | 3 | Consecutive frames required |
| `RAISED_ARM_THRESHOLD` | wrist.y < shoulder.y | Upper half enough |
| `STRAIGHT_ELBOW_MIN` | 140° | Raised arm must be nearly straight |
| `BENT_ELBOW_MAX` | 100° | Bent arm must be clearly bent |
| `FACE_DISTANCE_MAX` | 0.15 | Normalized distance wrist→nose |
| `MIN_LANDMARK_CONFIDENCE` | 0.5 | Skip frame if below |

---

## Agent Workflow

When an agent receives a task:
1. Read this SKILL.md first
2. Read the specific files it will modify (never edit blind)
3. Apply the principle: **smallest change that solves the problem**
4. Every new pattern discovered → add to SKILL.md under the relevant section
5. Every bug fixed → note the root cause in `docs/todo.md`

---

## Optimization Checklist

- [ ] MediaPipe WASM loads via CDN (no bundle bloat)
- [ ] `useRef` for: signalTime, frameCount, holisticInstance, streamRef
- [ ] `useState` only for: UI-visible values (gameState, cameraError, fps warning)
- [ ] Canvas cleared and redrawn only when `onResults` fires (not on every rAF)
- [ ] `will-change: transform` on neon-pulse element
- [ ] Framer Motion: `layout={false}` where not needed, no `layoutId` unless required
- [ ] API: abort controller with 5s timeout on every fetch
- [ ] No `console.log` in production (use `process.env.NODE_ENV === 'development'` guard)

---

## Wiki Log

_Agents append discoveries here (date · agent · finding)_

| Date | Finding |
|---|---|
| 2026-05-12 | Initial scaffold: Next.js 15 + MediaPipe Holistic + Supabase |
| 2026-05-12 | System design finalized: 3-frame confirmation, FPS monitor, ErrorBoundary |
| 2026-05-12 | Karpathy llm-wiki pattern adopted: SKILL.md as living schema |
