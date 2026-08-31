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

## The actual root cause (confirmed)

`self.picam2` on the `LiveFeedParams`/`liveFeedParams` singleton is **shared, mutable state** — every call to `start_feed()` does `self.picam2 = Picamera2()`, overwriting whatever was there before. Multiple things can read/write this at overlapping times:

- A stream session's `generate_frames` generator, running in its own worker thread, whose `finally: self.stop_feed()` cleanup can fire *late* — after the session has technically ended (client navigated away), sometime later once the thread actually gets torn down.
- A *new* stream session starting in the meantime (e.g., navigating back to the Dashboard), which overwrites `self.picam2` with a fresh camera object.

If the *old* session's delayed cleanup (`self.stop_feed()` → `self.picam2.close()`) fires **after** the new session has already overwritten `self.picam2`, it closes the **new** session's camera, not its own — potentially before the new session ever produces a single frame. This exactly explains "never shows a frame, ever" (killed before it could) and the inconsistency (depends entirely on timing — whether the old cleanup happens to fire before or after the new session starts).

**Why `colometry.py` never had this bug**: `process_colometry()` uses a purely **local** `picam2` variable — created, used, and closed all within one function call, never stored anywhere shared. Nothing else can ever reach in and touch it. The live-feed code never adopted that same pattern for the camera specifically — likely because `self.pixels1` (the LEDs) *correctly* stays shared (one physical LED ring, low-stakes if two things briefly race on it, no hard crash), and the camera got lumped into the same "shared instance state" pattern by association, even though the camera's stakes and lifecycle shape are completely different.

## The agreed redesign

Two complementary changes — not either/or, both address different parts of the problem:

### 1. Camera becomes local, not shared (fixes the root cause structurally)

Stop storing `self.picam2` as persistent instance state. Each stream session creates, uses, and closes its **own** camera object — mirroring `colometry.py`'s already-proven pattern exactly. This makes the "which session's cleanup is closing which camera" ambiguity structurally impossible, regardless of timing.

This changes how `/api/capture` stops the live feed, though — it currently reaches directly into `live_feed.picam2` to close it. With no shared camera reference to grab, we need a different coordination mechanism:

### 2. Stop coordination via a signal, not direct object access

Use a `threading.Event()` (or similar) that the running generator checks periodically instead of blocking on `output.condition.wait()` forever with no escape hatch. `/api/capture` just calls `.set()` on the event; the session that actually owns the camera notices, cleans up *its own* local reference, and exits — nobody outside ever touches another session's camera object directly. This also naturally solves the earlier-flagged thread-pool-exhaustion risk (indefinite blocking wait with no timeout), since checking a flag on an interval requires `wait(timeout=...)` instead of an unbounded wait.

### 3. Explicit "Start Preview" trigger, not auto-start on mount (user's proposal, confirmed as complementary, not a full fix on its own)

Currently the stream auto-starts the instant `Dashboard.jsx` mounts — every navigation to `/dashboard` fires a new session automatically, which is the single biggest source of *how often* the overlapping-session race actually gets hit in practice. Requiring an explicit button press (matching how Capture already works) doesn't make the race structurally impossible on its own (a fast double-click could still theoretically trigger it) — but combined with fix #1 (camera no longer shared) it removes the *only* mechanism that was causing sessions to overlap automatically via navigation, and is also a more deliberate UX pattern than hardware silently activating just from visiting a page.

## What's NOT decided yet — pick up here tomorrow

- Exact shape of the "Start Preview" / "Stop Preview" UI on the Dashboard (a toggle button? Where positioned relative to the existing Capture button?)
- Exact implementation of the local-camera-per-session pattern in `live_feed.py` — needs `start_feed`/`generate_frames` restructured so the camera object flows through as a parameter/local variable instead of `self.picam2`
- Exact shape of the stop-signal mechanism (`threading.Event`, or something else) and how `/api/capture` and the new explicit stop button both hook into it
- Whether `self.pixels1` (LEDs) staying shared is still fine under the new design (current thinking: yes, no change needed there — only the camera's sharing pattern was the actual problem)

## Verification plan once implemented

- Rapid navigate-away-and-back cycles (the original failure trigger) — confirm no "resource busy"/"cannot release un-acquired lock" regardless of timing
- Explicit Start → Stop → Start again in quick succession — confirm no collision even under fast manual retriggering
- Confirm `/api/capture` still cleanly stops an active preview before capturing, using the new signal-based mechanism instead of direct object access
- Re-run the isolated `close()`-then-reopen test from the investigation above as a sanity baseline, to confirm we haven't regressed the parts that were already confirmed working
