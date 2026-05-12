# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # dev server (Turbopack) at localhost:3000
npm run build    # production build
npm run lint     # ESLint
npm test         # Playwright e2e (requires running dev server or uses webServer auto-start)
npx playwright test --ui          # interactive test runner
npx playwright test tests/foo.spec.ts  # single test file
```

Env: copy `.env.example` → `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` before running.

## Architecture

**Game flow**: `page.tsx` runs a browser-compat gate (`useBrowserCompat`) before rendering. If the user clicks Play, `GameScreen` is lazy-loaded (`dynamic`, `ssr: false`) and wrapped in `ErrorBoundary`.

**State machine** (`src/lib/game-state.ts`): all `GameState` transitions go through `transition(from, to)`. Invalid transitions return `from` silently — never throw. The legal graph is:

```
IDLE → COUNTDOWN → WAITING → SIGNAL → DETECTED → RESULT → IDLE
                        └──────────→ FALSE_START ────────→ IDLE
```

`GameScreen` is the sole caller of `transition()` via a `go()` callback passed down to `CameraFeed` (as `onFalseStart`) and `GameTimer` (as `onStateChange`).

**Pose detection loop** (`CameraFeed.tsx`): on mount it calls `loadHolistic()` (lazy WASM, retries 3×, 12 s timeout) then drives a `requestAnimationFrame` loop that calls `holistic.send({ image: videoEl })` each frame. Results come back in `holistic.onResults()`. `gameStateRef` is kept in sync with `gameState` prop without causing effect re-runs — detection logic reads the ref, not the prop.

`DabDetector` (`src/lib/dab-detector.ts`) requires **3 consecutive confirmed frames** before emitting a dab. A single negative frame resets the counter. Detection inspects elbow angles and wrist-to-nose distance using MediaPipe Holistic's 33-landmark pose output.

**Camera errors** are classified in `useCamera` into `CameraErrorCode` (`NotAllowedError` / `NotFoundError` / `NotReadableError` / `stream-lost` / `unknown`). The `stream-lost` code fires from a `'ended'` event on the video track — not from an exception.

**API layer** (`src/lib/api.ts`): `submitScore` retries up to 2× with exponential backoff and a 5 s `AbortSignal.timeout`. A 400 response is never retried. Server-side (`src/app/api/score/route.ts`) re-validates the same bounds: `username` against `/^[a-zA-Z0-9_\- ]{1,20}$/`, `time_ms` as integer `100–30000`.

**Supabase** is used only server-side (API routes). The client is created per-request via `createClient()` in `src/lib/supabase.ts`.

## Key constraints

- `useRef` for anything that doesn't need to trigger a render: signal timestamp, frame counter, holistic instance, stream handle, timeout IDs.
- MediaPipe WASM (~10 MB) loads from `cdn.jsdelivr.net` — pinned to `@0.5.1675471629`. Do not bundle it.
- `performance.now()` for all timing. Never `Date.now()`.
- Every hook/component that opens a camera stream or MediaPipe instance must clean up in the effect return.
- The `tests/` directory is where Playwright specs go. There are none yet — new specs should mock camera via `page.addInitScript` or `page.route`.

## Living schema

`SKILL.md` at the repo root is a Karpathy-style llm-wiki: detection thresholds, design decisions, CSS conventions, and a wiki log. Read it before making changes to game logic or UI patterns, and append to the wiki log when adding new patterns.
