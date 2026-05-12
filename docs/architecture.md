# Dabspeed — Architecture

## System Diagram

```
User Browser
│
├── Next.js App (Vercel)
│   ├── / (Landing + Game)
│   │   ├── CameraFeed (WebRTC getUserMedia)
│   │   ├── PoseDetector (MediaPipe Holistic WASM)
│   │   ├── GameTimer (performance.now())
│   │   └── ResultScreen
│   └── /leaderboard
│       └── Leaderboard component
│
├── Next.js API Routes
│   ├── POST /api/score  → Supabase insert
│   └── GET  /api/leaderboard → Supabase select top 10
│
└── Supabase (PostgreSQL)
    └── scores table
```

## Game State Machine

```
IDLE ──(start)──→ COUNTDOWN ──(0)──→ WAITING
                                         │
                              random delay 1-3s
                                         │
                                       SIGNAL ──(dab detected)──→ RESULT
                                         │
                              (false start)──→ PENALTY
```

## Dab Pose Detection

MediaPipe Holistic outputs 33 body landmarks (x, y, z normalized).

Key landmarks for dab:
- `LEFT_SHOULDER` (11), `LEFT_ELBOW` (13), `LEFT_WRIST` (15)
- `RIGHT_SHOULDER` (12), `RIGHT_ELBOW` (14), `RIGHT_WRIST` (16)
- `NOSE` (0)

Dab conditions:
1. One arm **raised**: wrist.y < shoulder.y (wrist above shoulder)
2. Other arm **bent into face**: elbow angle < 90°, wrist near nose
3. Head **tilted**: nose x-position shifts toward bent arm

## Database Schema

```sql
CREATE TABLE scores (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username    text NOT NULL,
  time_ms     integer NOT NULL CHECK (time_ms > 0),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read" ON scores FOR SELECT USING (true);
CREATE POLICY "anyone can insert" ON scores FOR INSERT WITH CHECK (true);
```

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Pose library | MediaPipe Holistic | Full body landmarks, runs in browser WASM |
| DB | Supabase | Free tier, real-time capable, easy RLS |
| Framework | Next.js 15 App Router | SSR for leaderboard SEO, API routes built-in |
| CSS | Tailwind v4 | Fast iteration, no CSS files needed |
| Timer | `performance.now()` | Sub-millisecond precision |
