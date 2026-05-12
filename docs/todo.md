# Dabspeed — TODO

## Setup
- [ ] `npm install`
- [ ] Create Supabase project
- [ ] Copy `.env.example` → `.env.local` and fill values
- [ ] Run `npm run dev`

## Supabase
- [ ] Create `scores` table: `id uuid, username text, time_ms int, created_at timestamptz`
- [ ] Enable Row Level Security (RLS)
- [ ] Add policy: anyone can INSERT, anyone can SELECT

## Game Logic
- [ ] Implement `dab-detector.ts` — angle math for dab pose
- [ ] Define threshold constants (elbow angle, wrist height, head occlusion)
- [ ] Test with real webcam + calibrate thresholds
- [ ] Handle: no camera, camera denied, low FPS

## Components
- [ ] `CameraFeed` — render video + canvas overlay
- [ ] `PoseDetector` — MediaPipe loop, emit pose events
- [ ] `GameTimer` — countdown + reaction timer
- [ ] `ResultScreen` — show time, replay, submit to leaderboard
- [ ] `Leaderboard` — fetch top 10, display table

## Testing
- [ ] Playwright: page load test
- [ ] Playwright: camera permission mock
- [ ] Playwright: leaderboard API test
- [ ] Playwright: full game flow (mock pose data)

## Deploy
- [ ] Push to GitHub
- [ ] Connect Vercel
- [ ] Set env vars in Vercel dashboard
