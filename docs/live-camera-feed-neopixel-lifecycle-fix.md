# NeoPixel LED Lifecycle Fix — Capture-Time Race

Companion to [live-camera-feed-session-lifecycle-fix.md](live-camera-feed-session-lifecycle-fix.md), which covers the camera/streaming-output race this bug is the same *family* as. Split into its own doc since the mechanism (last-write-wins on shared hardware, not a resource-acquisition failure) and the fix (a confirmation handshake, not a retry loop) are different enough to deserve separate treatment.

## The symptom

Discovered during functional testing ahead of handoff to the chemistry department. The LED ring lit correctly during the live preview. The instant Capture was pressed, it briefly flashed to a noticeably *brighter* level, then went dark — and stayed dark through the entire 5-shot capture sequence, well before `colometry.py`'s own cleanup code ever ran. No exception anywhere in the logs.

## Root cause

Same family as the camera race — a delayed cleanup from an old session reaching in after a new session has already claimed something — but a different mechanism underneath.

`board.D18` is one physical GPIO pin. `live_feed.py`'s `self.pixels1` is a long-lived singleton: created once when the app starts, never released. `colometry.py` creates its own brand-new `NeoPixel(board.D18, ...)` on every single capture. Unlike the camera — which fails outright with "device busy" if something else already holds it — constructing a second `NeoPixel` object pointing at the same pin never fails. Multiple objects can happily target the same physical pin with zero errors. Whichever object's `.fill()` call executes **chronologically last** simply wins on the real hardware.

That explains the flicker precisely:
1. Preview's `self.pixels1` is lit at preview brightness.
2. Capture pressed → `stop_stream()` only *signals* the old preview session to stop, and returns immediately without waiting.
3. `process_colometry()` starts right away, creates its own `pixels1`, calls `.fill(LED_COLOR)` at full brightness — **this is the flicker**, genuinely successful, just brighter than preview's dimmer setting.
4. Independently, in a separate thread, the old preview session's generator is still finishing its own shutdown — it can take a noticeable amount of time to notice the stop signal and finish closing its camera.
5. That old session's cleanup includes `self.pixels1.fill((0, 0, 0))` — writing to the same physical pin. If this lands *after* step 3, it silently overwrites the new capture's "on" state with "off," with no exception raised anywhere, since nothing actually failed at the Python level.

A last-write-wins race, not an acquisition failure — this is why retry-on-failure (the camera's fix) doesn't apply here. Nothing to retry; nothing ever throws.

## The fix: wait-for-confirmation handshake

Not a retry loop — an ordering guarantee. Don't just signal the old session to stop and immediately proceed; actually wait until it confirms it's *done* stopping before the new capture touches the LED at all.

Two separate `threading.Event`s, each with one job:
- **`stop_event`** — the "please stop" request. Capture sets it; the running `generate_frames` loop checks it to know when to exit.
- **`stop_confirmed`** — the "I'm actually done" acknowledgment. The old session sets this itself, only *after* its own cleanup (camera close, LED off) has fully finished.

Capture sets the first, then blocks on the second, before touching the LED itself.

### Implementation

`live_feed.py` — both events created fresh per session, threaded through as parameters (never re-read from `self.` inside a delayed callback — same discipline as the camera fix, since a delayed `finally` reading a shared slot again is exactly what caused the original camera bug):

```python
class liveFeedParams:
    def __init__(self):
        self.current_stop_event = None
        self.current_stop_confirmed = None

    def start_feed(self, output):
        if self.current_stop_event:
            self.current_stop_event.set()
        stop_event = threading.Event()
        stop_confirmed = threading.Event()          # <-- STOP CONFIRMED (this doc): fresh "I'm done" flag, one per session
        self.current_stop_event = stop_event
        self.current_stop_confirmed = stop_confirmed  # <-- STOP CONFIRMED: stored in the shared slot — safe only because
                                                        #     generate_frames() below never re-reads this slot
        picam2 = open_camera()
        ...
        return picam2, stop_event, stop_confirmed    # <-- STOP CONFIRMED: handed out as a value, not left in self.

    def stop_feed(self, picam2):
        # closes picam2, then turns off self.pixels1 — unchanged
        ...

    def generate_frames(self, picam2, output, stop_event, stop_confirmed):
        # ^ stop_confirmed here is STOP CONFIRMED: the captured parameter, NEVER self.current_stop_confirmed
        try:
            while not stop_event.is_set():
                ...
        finally:
            self.stop_feed(picam2)     # camera closed, LED off — happens first
            stop_confirmed.set()       # <-- STOP CONFIRMED: only THEN confirm — local reference, not self.current_stop_confirmed
```

`main.py` — order matters critically here. Signal must happen *before* the wait, or this deadlocks forever (the old session would never see a stop request it wasn't sent yet):

```python
def stop_stream():
    stop_event = live_feed.current_stop_event
    stop_confirmed = live_feed.current_stop_confirmed   # <-- STOP CONFIRMED: local capture, read from the shared slot once
    if stop_event:
        stop_event.set()                    # 1. ask it to stop
        stop_confirmed.wait(timeout=10.0)   # <-- STOP CONFIRMED: 2. wait for confirmation it actually did
    return {"message": "Stop signal sent."}
```

Local variables (`stop_event`, `stop_confirmed`) captured once at the top — not `live_feed.current_stop_event` re-read later — same reasoning as everywhere else this pattern shows up: a shared slot can be overwritten by a newer session before a delayed operation gets around to using it.

**Timeout choice: `10.0`s**, matching the camera's retry-budget magnitude (5 attempts × 2.0s). Not arbitrary — `stop_confirmed` only fires *after* `stop_feed()`'s camera-close step completes, and that's the exact same slow step already measured taking several seconds worst-case during the camera retry-budget investigation. The LED confirmation is riding on that same underlying delay, not a separate one to estimate independently.

## Full sequence, step by step

Written out end to end so this doesn't need to be re-derived cold later.

**1.** Frontend calls `POST /api/capture` → `run_colometry()`:
```python
@router.post("/capture")
def run_colometry():
    stop_stream()               # step 2 happens inside here
    ...
    result = process_colometry()  # step 8 happens inside here
```

**2.** `stop_stream()` grabs local copies, signals "please stop," then pauses:
```python
stop_event = live_feed.current_stop_event
stop_confirmed = live_feed.current_stop_confirmed   # <-- STOP CONFIRMED
if stop_event:
    stop_event.set()
    stop_confirmed.wait(timeout=10.0)   # <-- STOP CONFIRMED: execution pauses here
```

**3.** Meanwhile, in a separate thread, the old preview session's loop notices the flag on its next check and exits:
```python
while not stop_event.is_set():
    ...
```

**4.** That thread's `finally` closes the camera and turns the LED off:
```python
finally:
    self.stop_feed(picam2)   # closes camera, then: self.pixels1.fill((0, 0, 0))
```

**5.** Right after, the same `finally` confirms it's done:
```python
    stop_confirmed.set()   # <-- STOP CONFIRMED: the SAME Event object stop_stream() is waiting on
```

**6.** Back in `stop_stream()`, the `.wait()` from step 2 immediately unblocks. `stop_stream()` returns.

**7.** `run_colometry()` moves on to `process_colometry()`.

**8.** `process_colometry()` sets its own LED color — guaranteed to happen *after* step 4's "off," since steps 2-7 all had to complete first:
```python
pixels1 = neopixel.NeoPixel(board.D18, 7, brightness=1)
pixels1.fill(LED_COLOR)
```

Steps 3-5 (old session shutting down) are now forced to fully finish before step 8 (new capture's LED) ever runs — no more race between "old turning off" and "new turning on."

## Status

Implemented in `live_feed.py` and `main.py`. Not yet stress-tested with repeated rapid preview→capture cycles on real hardware — do that before considering this fully closed, same as the camera fix's own verification plan.
