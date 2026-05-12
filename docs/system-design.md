# Dabspeed — System Design (Error-Resistant)

## Error Surface Map

ทุก error ที่เกิดได้ แบ่งตาม origin:

```
┌─────────────────────────────────────────────────────┐
│  USER ERRORS              │  SYSTEM ERRORS           │
│  ─────────────────────    │  ──────────────────────  │
│  • Dab before signal      │  • Camera denied/missing  │
│  • Invalid username       │  • MediaPipe WASM fail    │
│  • Spam submit score      │  • Low FPS detection      │
│  • Refresh mid-game       │  • Supabase down          │
│  • Partial dab pose       │  • Network timeout        │
│  • Wrong arm position     │  • Memory leak (video)    │
│  • Standing too far/close │  • Browser incompatible   │
└─────────────────────────────────────────────────────┘
```

---

## 1. Game State Machine (Strict)

ป้องกัน invalid transition ด้วย allowed-transition table:

```
                    ┌──────────┐
                    │   IDLE   │◄──────────────────────┐
                    └────┬─────┘                       │
                         │ user clicks start           │
                    ┌────▼─────┐                       │
                    │COUNTDOWN │                       │
                    └────┬─────┘                       │
                         │ count reaches 0             │
                    ┌────▼─────┐                       │
                    │ WAITING  │                       │
                    └────┬─────┘                       │
                         │ random delay (1000–3000ms)  │
                    ┌────▼─────┐                       │
              ┌─────│  SIGNAL  │─────┐                 │
              │     └──────────┘     │                 │
   dab before │                      │ dab AFTER signal│
   signal     ▼                      ▼                 │
         ┌──────────┐         ┌────────────┐           │
         │FALSE_START│        │  DETECTED  │           │
         └─────┬────┘         └─────┬──────┘           │
               │                   │                   │
               └───────────────────▼                   │
                              ┌────────┐               │
                              │ RESULT │───────────────┘
                              └────────┘
```

**Rule**: state ใด transition ไม่ได้ = ignore silently (ไม่ throw)

```ts
const ALLOWED_TRANSITIONS: Record<GameState, GameState[]> = {
  idle:        ['countdown'],
  countdown:   ['waiting'],
  waiting:     ['signal'],
  signal:      ['detected', 'false_start'],
  detected:    ['result'],
  false_start: ['result'],
  result:      ['idle'],
}

function transition(from: GameState, to: GameState): GameState {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) return from  // silently ignore
  return to
}
```

---

## 2. Camera Layer — Error Handling

### States

```
CAMERA_IDLE → REQUESTING → ACTIVE → ERROR
                              │
                              └──► LOST (stream ended mid-game)
```

### Error codes + UX response

| Error | Cause | UX |
|---|---|---|
| `NotAllowedError` | User denied permission | Show "Allow camera" + guide GIF |
| `NotFoundError` | No camera device | Show "No camera found" + fallback |
| `NotReadableError` | Camera in use by another app | Show "Camera busy" message |
| `stream ended` | Unplug / system sleep | Pause game → show "Camera lost" → offer retry |
| Low FPS (<15fps) | Old device / lighting | Warn banner "Detection may be inaccurate" |

### Recovery pattern

```ts
async function startCamera(retries = 3): Promise<MediaStream> {
  for (let i = 0; i < retries; i++) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        throw err  // user denied — don't retry
      }
      if (i === retries - 1) throw err
      await sleep(500 * (i + 1))  // backoff
    }
  }
  throw new Error('Camera unavailable')
}
```

---

## 3. MediaPipe Layer — Error Handling

### Load failure

MediaPipe loads WASM from CDN — can fail on slow/offline connections.

```ts
async function loadHolisticWithTimeout(ms = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const holistic = await loadHolistic()
    clearTimeout(timer)
    return holistic
  } catch {
    throw new Error('Pose detection failed to load. Check your connection.')
  }
}
```

### Detection reliability

| Issue | Mitigation |
|---|---|
| Landmark confidence < 0.5 | Skip frame (don't update state) |
| No person detected | Show "Stand in frame" indicator |
| Partial body (only upper half) | Required landmarks only = upper body OK |
| Jitter / false positive | Require dab held for **3 consecutive frames** |
| False negative (too strict) | Loosen threshold after 2s in SIGNAL state |

### Consecutive-frame confirmation

```ts
let dabFrameCount = 0
const DAB_CONFIRM_FRAMES = 3

function onPoseResults(results: Results) {
  const { isDab } = detectDab(results.poseLandmarks)
  if (isDab) {
    dabFrameCount++
    if (dabFrameCount >= DAB_CONFIRM_FRAMES) {
      // confirmed — not a fluke
      onDabConfirmed()
    }
  } else {
    dabFrameCount = 0  // reset on frame miss
  }
}
```

---

## 4. API Layer — Error Handling

### Score submission

```
POST /api/score
  │
  ├── Validate input (server-side)
  │     username: string, 1–20 chars, alphanumeric + spaces
  │     time_ms: integer, 100–30000 (reject impossibly fast / too slow)
  │
  ├── Rate limit: 10 submissions / IP / hour (via Supabase RLS + timestamp check)
  │
  └── Supabase error → 500 → client shows "Couldn't save, try again"
```

### Client retry pattern

```ts
async function submitScore(data: ScorePayload, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) return await res.json()
    if (res.status === 400) throw new Error('Invalid score data')  // don't retry
    if (i < retries) await sleep(1000 * (i + 1))
  }
  throw new Error('Score submission failed')
}
```

---

## 5. User Input Validation

### Username

```ts
const USERNAME_RE = /^[a-zA-Z0-9_\- ]{1,20}$/

function validateUsername(name: string): string | null {
  if (!name.trim()) return 'Name required'
  if (!USERNAME_RE.test(name)) return 'Letters, numbers, spaces only'
  return null  // valid
}
```

### Score sanity bounds

```ts
const MIN_HUMAN_REACTION_MS = 100   // world record ~150ms — anything under = bug/cheat
const MAX_WAIT_MS = 30_000           // 30s = gave up

function isSaneScore(ms: number): boolean {
  return ms >= MIN_HUMAN_REACTION_MS && ms <= MAX_WAIT_MS
}
```

---

## 6. Browser Compatibility Guard

ตรวจก่อน render game:

```ts
interface CompatResult {
  ok: boolean
  missing: string[]
}

function checkBrowserCompat(): CompatResult {
  const missing: string[] = []
  if (!navigator.mediaDevices?.getUserMedia) missing.push('Camera API')
  if (typeof WebAssembly === 'undefined') missing.push('WebAssembly')
  if (!window.performance?.now) missing.push('High-resolution timer')
  return { ok: missing.length === 0, missing }
}
```

ถ้า `!ok` → แสดง unsupported screen แทน game (ไม่ crash)

---

## 7. Memory Management

Video stream + MediaPipe = memory-intensive. ต้องทำ cleanup ทุกครั้ง:

```ts
// cleanup hook — runs on unmount / game exit
useEffect(() => {
  return () => {
    holisticRef.current?.close()
    cameraRef.current?.stop()
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream)
        .getTracks().forEach(t => t.stop())
    }
  }
}, [])
```

---

## 8. React Error Boundary

ครอบ `<GameScreen>` ทั้งหมด ไม่ให้ crash ทั้ง app:

```tsx
// src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Dabspeed Error]', error, info)
  }
  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="text-center p-8 text-red-400">
          Something went wrong. <button onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}
```

---

## 9. False Start Detection

จะเกิดเมื่อ user dab ก่อน SIGNAL state

```
WAITING state:
  if (isDab detected) → transition to FALSE_START
    → show "TOO EARLY!" overlay (red flash)
    → wait 2s
    → back to IDLE (not auto-restart — user must click)
```

ป้องกัน exploit: reset `signalTime` ทุกครั้งที่เกิด false start ใหม่

---

## 10. FPS Monitor

ถ้า FPS ต่ำ → detection ช้า → ผล score ไม่ accurate

```ts
function useFPSMonitor() {
  const [fps, setFps] = useState<number | null>(null)
  useEffect(() => {
    let frames = 0, last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      setFps(Math.round(frames / ((now - last) / 1000)))
      frames = 0; last = now
    }, 1000)
    const tick = () => { frames++; requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
    return () => clearInterval(id)
  }, [])
  return fps
}

// ถ้า fps < 15 → แสดง warning banner ใน game screen
```

---

## Error Priority Matrix

| Severity | Error | Action |
|---|---|---|
| 🔴 Fatal | Camera denied / no camera | Block game start, show guide |
| 🔴 Fatal | WebAssembly not supported | Show unsupported page |
| 🟠 High | MediaPipe load fail | Retry 3x, then error screen |
| 🟠 High | Camera lost mid-game | Pause + offer retry |
| 🟡 Medium | Low FPS | Warning banner, game continues |
| 🟡 Medium | Score submit fail | Toast error, keep result visible |
| 🟢 Low | False start | Penalty screen, user retries |
| 🟢 Low | Invalid username | Inline validation, block submit |
