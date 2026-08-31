# Live Feed Camera Session Lifecycle — Debugging Journey & Redesign Plan

Companion to [live-camera-feed-encoders-and-outputs.md](live-camera-feed-encoders-and-outputs.md) and [live-camera-feed-led-preview-lighting.md](live-camera-feed-led-preview-lighting.md). Those docs cover the original design; this one covers a serious bug found *after* implementation, the full investigation that led to the real root cause, and the agreed redesign — written so this can be picked back up cold, without re-deriving anything.

## The symptom

After capturing, returning to the Dashboard's live preview would either show nothing at all (stayed on the "Camera Feed Offline" placeholder forever) or work inconsistently — sometimes fine, sometimes not, with `journalctl` showing:
```
WARNING:root:Removed streaming client: cannot release un-acquired lock
```
5-7 seconds after the stream started, every time it failed. Confirmed via DevTools Network tab: **zero frames were ever actually received by the browser** during these failures — not a "started working then died" problem, but "never worked at all this session."

## The investigation — what we tried, what we ruled out, and why

Documenting the false leads deliberately, since each one was a reasonable hypothesis at the time and ruling them out is exactly what narrowed things down. Don't re-investigate these tomorrow.

1. **`ModuleNotFoundError: No module named 'live_feed'`** — filename was `live-feed.py` (hyphen), Python imports need `live_feed.py` (underscore, valid identifier). Fixed by renaming. Real bug, fixed, not related to the deeper issue below.

2. **`RuntimeError: Must pass io.BufferedIOBase`** — `StreamingOutput` class didn't inherit from `io.BufferedIOBase`, which `picamera2`'s `FileOutput` requires. Fixed by adding the base class. Real bug, fixed, not related to the deeper issue below.

3. **`RuntimeError: Failed to acquire camera: Device or resource busy`** — `stop_feed()` only called `picam2.stop_recording()`, never `picam2.close()` — left the camera in `Configured` state instead of `Available`, blocking the next session from acquiring it. Fixed by adding `close()`. **Real bug, correctly fixed** — but as we later learned, this wasn't the *only* thing broken; it was necessary but not sufficient.

4. **nginx buffering the entire response before forwarding anything to the browser** — confirmed via evidence (all requests logged as `HTTP/1.0`, nginx's default `proxy_http_version`). Fixed with `proxy_http_version 1.1`, `proxy_buffering off`, `proxy_set_header Connection ""` on a dedicated `location /api/stream` block. **Real, confirmed, correctly-applied fix** (verified requests now show `HTTP/1.1`) — but the core symptom persisted after this fix too.

5. **Browser silently reusing/deduping the stale connection from before a capture, instead of firing a fresh request on remount** — confirmed via evidence (zero new request in Network tab on remount). Fixed with cache-busting: `useState(() => Date.now())` generating a unique `streamKey`, used both as a `key` prop (forces full DOM remount) and a query param on the `src` URL. **Real, confirmed, correctly-applied fix** — genuinely solved the "no new request at all" problem, and as a bonus, also fixed browsers not auto-retrying a broken `<img>` — but the *new*, fresh requests this produced still failed with the same "never shows a frame" symptom.

6. **libcamera version regression (`v0.7.2` broken vs. `v0.7.1` known-good)** — a real, previously-confirmed regression from earlier in this project (documented in the main readme's Troubleshooting section), and the version *did* still match `v0.7.2`. **Ruled out** via a direct isolated test:
   ```bash
   python3 -c "
   from picamera2 import Picamera2
   import time
   picam2 = Picamera2()
   picam2.configure(picam2.create_video_configuration(main={'size': (640, 480)}))
   picam2.start_recording(__import__('picamera2.encoders', fromlist=['JpegEncoder']).JpegEncoder(), __import__('picamera2.outputs', fromlist=['FileOutput']).FileOutput(open('/dev/null', 'wb')))
   time.sleep(2)
   picam2.stop_recording()
   picam2.close()
   picam2_2 = Picamera2()
   picam2_2.configure(picam2_2.create_video_configuration(main={'size': (640, 480)}))
   print('SUCCESS: second Picamera2() acquired cleanly after close()')
   "
   ```
   This succeeded cleanly, on the *same* `v0.7.2` build, with the backend service stopped first (via `sudo systemctl stop cologama-backend`) to guarantee nothing else was contending for the camera. **`close()` genuinely works correctly in isolation.** This was an important negative result — it proved the bug is specific to how the *app* orchestrates the camera, not the camera stack itself.

## Verification via direct logging (id()/thread-name instrumentation)

Added `id(self.picam2)` + thread-name logging to `start_feed`/`stop_feed`/`generate_frames` and captured two full reproduction cycles (preview → capture → preview → navigate-away → preview again) end to end via `journalctl`.

**Result: zero `self.picam2` id mismatches across both runs.** Every logged `stop_feed()` call closed the camera id that was actually correct for that moment — the race is real and structurally possible (see below), but is timing-dependent and simply didn't land in either captured run. Not proof against the hypothesis, just not caught yet.

**But a second, independently real bug turned up in the same logs**: `Removed streaming client: cannot release un-acquired lock`, immediately preceding a `stop_feed()` call in both runs. Root cause confirmed by reading `main.py`: `streaming_output = StreamingOutput()` (line 13) is a **single module-level instance**, shared across every `/api/stream` call — the exact same "one shared mutable singleton, many overlapping session threads" shape as `self.picam2`, just on the `output`/`Condition` object instead of the camera. Every session's `generate_frames` does `with output.condition: output.condition.wait()` on the *same* underlying `Lock`. `Condition.wait()` releases and re-acquires that lock internally; if a `GeneratorExit` lands mid-`wait()` in one session's thread while another session's thread is also mid-wait on the same lock, the exiting thread's `__exit__` can find the lock in a state it doesn't own → `cannot release un-acquired lock`, which kills that generator early via the `except` clause.

This fully explains the "worked for a bit, then died" symptom on its own, without requiring an actual id mismatch — confirmed via logs, not inferred.

## The actual root cause (confirmed)

`self.picam2` on the `LiveFeedParams`/`liveFeedParams` singleton is **shared, mutable state** — every call to `start_feed()` does `self.picam2 = Picamera2()`, overwriting whatever was there before. Multiple things can read/write this at overlapping times:

- A stream session's `generate_frames` generator, running in its own worker thread, whose `finally: self.stop_feed()` cleanup can fire *late* — after the session has technically ended (client navigated away), sometime later once the thread actually gets torn down.
- A *new* stream session starting in the meantime (e.g., navigating back to the Dashboard), which overwrites `self.picam2` with a fresh camera object.

If the *old* session's delayed cleanup (`self.stop_feed()` → `self.picam2.close()`) fires **after** the new session has already overwritten `self.picam2`, it closes the **new** session's camera, not its own — potentially before the new session ever produces a single frame. This exactly explains "never shows a frame, ever" (killed before it could) and the inconsistency (depends entirely on timing — whether the old cleanup happens to fire before or after the new session starts).

**Why `colometry.py` never had this bug**: `process_colometry()` uses a purely **local** `picam2` variable — created, used, and closed all within one function call, never stored anywhere shared. Nothing else can ever reach in and touch it. The live-feed code never adopted that same pattern for the camera specifically — likely because `self.pixels1` (the LEDs) *correctly* stays shared (one physical LED ring, low-stakes if two things briefly race on it, no hard crash), and the camera got lumped into the same "shared instance state" pattern by association, even though the camera's stakes and lifecycle shape are completely different.

## Approaches considered

Three real options weighed before committing:

- **A — Local-per-session** (chosen): camera and streaming output both become local per request, mirroring `colometry.py`'s already-proven pattern. Kills both bugs structurally — no shared slot, no shared lock, nothing left to race over. Costs the most code change, and needs a busy-camera guard if two viewers ever load the Dashboard at once (Picamera2 will throw "device busy" on the second `Picamera2()` open).
- **B — Lock around the existing shared state**: smallest diff, but only serializes access — doesn't remove the underlying "which session does this object actually belong to" ambiguity, just prevents it from firing concurrently. Easy for a future edit to accidentally do camera work outside the lock and silently reintroduce the bug. Rejected.
- **C — Persistent camera, broadcast to viewers**: camera opens once and stays alive for the app's lifetime; sessions just subscribe to an ongoing frame stream instead of starting/stopping camera hardware per session. Sidesteps the start/stop race entirely and naturally supports multiple simultaneous viewers. Biggest architectural shift of the three and the least familiar pattern to maintain. **Not chosen now, but worth keeping on record** — if a future maintainer wants to support multiple concurrent viewers (e.g. more than one phone watching the preview on the hotspot at once) or wants the camera to stay warm instead of reinitializing per session, this is the path to revisit.

## The agreed redesign

Two complementary changes — not either/or, both address different parts of the problem:

### 1. Camera *and* streaming output become local, not shared (fixes the root cause structurally)

Stop storing `self.picam2` as persistent instance state. Each stream session creates, uses, and closes its **own** camera object — mirroring `colometry.py`'s already-proven pattern exactly. This makes the "which session's cleanup is closing which camera" ambiguity structurally impossible, regardless of timing.

**Also stop sharing `streaming_output`** (`main.py:13`, `StreamingOutput()` created once at module scope). Confirmed via direct logging that this causes its own independent bug (`cannot release un-acquired lock`, see verification section above) from two sessions' generators both calling `.wait()` on the same `Condition`. Each `/api/stream` request should construct its own `StreamingOutput()` and pass it through to both `start_feed()` and `generate_frames()` — no cross-session sharing at all, same fix shape as the camera.

This changes how `/api/capture` stops the live feed, though — it currently reaches directly into `live_feed.picam2` to close it. With no shared camera reference to grab, we need a different coordination mechanism:

### 2. Stop coordination via a signal, not direct object access

Use a `threading.Event()` that the running generator checks periodically instead of blocking on `output.condition.wait()` forever with no escape hatch. `/api/capture` just calls `.set()` on the event; the session that actually owns the camera notices, cleans up *its own* local reference, and exits — nobody outside ever touches another session's camera object directly. This also naturally solves the earlier-flagged thread-pool-exhaustion risk (indefinite blocking wait with no timeout), since checking a flag on an interval requires `wait(timeout=...)` instead of an unbounded wait.

**Decided shape**: `live_feed` keeps one shared slot, `self.current_stop_event`, same as `self.picam2` used to be — but this one is safe to share, for a specific reason. `start_feed()` creates a fresh `threading.Event()`, `.set()`s whatever was previously in the slot (tells the old session to stop), then overwrites the slot with the new event. Critically, `generate_frames()` receives that event as a **function argument** and checks *that captured reference* on every loop (`while not stop_event.is_set()`) — it never re-reads `self.current_stop_event`. So even if the slot gets overwritten by a newer session later, an old thread's own check is unaffected; it's still looking at its own object. `/api/capture` calls `live_feed.current_stop_event.set()` to stop whichever session is currently active/visible.

This is the mechanical fix for the original bug, generalized: **capture a shared reference once, into a local, and never re-read the shared attribute again.** `self.picam2.close()` broke this rule (re-read at cleanup time, arbitrarily later); the new pattern doesn't.

```python
# inside liveFeedParams
self.current_stop_event = None

def start_feed(self, output):
    if self.current_stop_event:
        self.current_stop_event.set()
    stop_event = threading.Event()
    self.current_stop_event = stop_event
    picam2 = Picamera2()
    ...
    return picam2, stop_event

def generate_frames(self, picam2, output, stop_event):
    try:
        while not stop_event.is_set():
            with output.condition:
                got_frame = output.condition.wait(timeout=1.0)
                if not got_frame:
                    continue
                frame = output.frame
            yield (...)
    finally:
        # local cleanup of picam2, never self.picam2
        ...
```

### 4. Busy-camera guard (retry with backoff)

Once the camera is local-per-session, `Picamera2()` can throw `RuntimeError: Failed to acquire camera: Device or resource busy` if a new session tries to open while the previous one hasn't fully released the hardware yet — a real hardware constraint (only one process can hold the camera), not a design flaw to eliminate.

Two triggers considered:
1. Fast navigate-away-and-back — old session's `close()` hasn't finished releasing hardware yet. Expected to be the common case on this single-user kiosk device.
2. Genuine concurrent viewers — two phones/tabs both load the Dashboard at once. Expected to be rare here.

**Decided approach: retry with short backoff.** `start_feed()` catches the busy error and retries a few times (e.g. 3 attempts, ~200ms apart) before giving up. Absorbs trigger #1 transparently — the common case just works, no user-visible error. A genuine conflict (#2) still surfaces as an error after retries are exhausted, same as fail-fast would, just slightly delayed. Rejected alternatives: fail-fast immediately (would misfire on the common, self-resolving timing gap) and block-and-wait via `Semaphore`/`Lock` (reintroduces the same indefinite-blocking thread-pool-exhaustion risk the `Event` timeout was specifically added to remove).

### 3. ~~Explicit "Start Preview" trigger~~ — cancelled, keeping auto-start on mount

Originally proposed to reduce how often sessions overlap in practice. **Cancelled by user decision** — with fix #1 in place (camera and streaming output both local per session), overlapping sessions are structurally harmless regardless of how often they happen, so the button doesn't buy correctness, only adds a UX step. Auto-start-on-mount stays as-is.

**Consequence this creates**: with no explicit Stop button, the `useEffect` cleanup-on-unmount in `Dashboard.jsx` (previously a known gap, not yet implemented — see file notes) is no longer optional. It becomes the *only* mechanism that ever ends a session besides pressing Capture. Skipping it means every navigate-away leaves a session's generator thread orphaned until its own `finally` eventually fires — same shape as the original bug, just without the shared-state part. Must ship together with fix #1, not as a follow-up.

## Implementation status

Implemented across `live_feed.py`, `main.py`, `colometry.py`, `api.js`, and `Dashboard.jsx`:
- `live_feed.py`: `open_camera()` retry-with-backoff helper (module-level, shared with `colometry.py`); `start_feed`/`stop_feed`/`generate_frames` all local-camera-per-session; `self.current_stop_event` slot with the captured-once-as-parameter pattern; `wait(timeout=1.0)` loop; `yield` moved outside the `output.condition` lock.
- `main.py`: `streaming_output` no longer module-level, created fresh per `/api/stream` request; new `POST /api/stream/stop` route sends the stop signal; `run_colometry()` calls `stop_stream()` instead of touching any camera object directly.
- `colometry.py`: uses `open_camera()` instead of a raw `Picamera2()` call, so it retries if it races the preview session's not-yet-finished cleanup.
- `api.js` / `Dashboard.jsx`: new `stopFeed()` helper; `useEffect` cleanup calls it on unmount, so navigating away from the Dashboard without capturing still releases the camera and turns off the preview LED.

Not yet done — real-device testing against the verification plan below. Retry count/backoff interval (3 attempts, ~200ms) is a starting guess, not yet tuned against real hardware timing.

## Verification plan once implemented

- Rapid navigate-away-and-back cycles (the original failure trigger) — confirm no "resource busy"/"cannot release un-acquired lock" regardless of timing
- Explicit Start → Stop → Start again in quick succession — confirm no collision even under fast manual retriggering
- Confirm `/api/capture` still cleanly stops an active preview before capturing, using the new signal-based mechanism instead of direct object access
- Re-run the isolated `close()`-then-reopen test from the investigation above as a sanity baseline, to confirm we haven't regressed the parts that were already confirmed working
