# Dabspeed — Project Plan

## Overview
Web game where users perform a "Dab" pose (both arms: one raised straight, other bent with face buried in elbow) as fast as possible after a signal. Webcam detects the pose via MediaPipe Holistic. Score = reaction time in milliseconds. Leaderboard via Supabase.

## Tech Stack
- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Pose Detection**: MediaPipe Holistic (body keypoints)
- **Realtime DB**: Supabase (scores + leaderboard)
- **Animation**: Framer Motion
- **Testing**: Playwright
- **Deploy**: Vercel

## Phases

### Phase 1 — Foundation (Current)
- [x] Project scaffold + git init
- [ ] Install dependencies
- [ ] Supabase schema setup
- [ ] Basic Next.js pages

### Phase 2 — Core Game Loop
- [ ] Camera feed component (getUserMedia)
- [ ] MediaPipe Holistic integration
- [ ] Dab pose detection algorithm (angle thresholds)
- [ ] Game state machine: IDLE → COUNTDOWN → WAITING → DETECTED → RESULT
- [ ] Timer (ms precision)

### Phase 3 — UI/UX
- [ ] Landing page with instructions
- [ ] Game screen (camera + overlay)
- [ ] Result screen (time + share)
- [ ] Leaderboard page
- [ ] Responsive design + mobile warning

### Phase 4 — Polish & Deploy
- [ ] Animations (Framer Motion)
- [ ] Sound effects
- [ ] False start detection (dabbing before signal)
- [ ] Playwright test suite
- [ ] Vercel deploy + env setup
