# NeoPixel LED During Live Positioning Preview — Design Plan

Companion to [live-camera-feed-encoders-and-outputs.md](live-camera-feed-encoders-and-outputs.md), which covers the streaming encoder/output decision (`JpegEncoder` + custom `StreamingOutput`, mutually exclusive with capture). This doc covers the LED behavior specifically.

## Context

The live preview exists so the operator can see and position a sample under the camera before pressing Capture. Without illumination, the preview is close to useless in anything but a well-lit room — the LED ring needs to be on while the stream is active, not just during the ~30-second capture burst like today.

## Decision: LED lifecycle mirrors the camera stream lifecycle

Same mutual-exclusivity principle already agreed for the camera itself (see the encoders doc): `neopixel.NeoPixel(board.D18, 7)` is a single hardware resource, same as the camera. The preview's LED session and the capture sequence's LED session must not run concurrently — LEDs turn on when the stream starts, turn off when the stream stops (including automatically when a capture request comes in and takes over).

This isn't a new problem to solve from scratch — it's the same shape as the camera-lock bug already debugged this session (`colometry.py`'s `finally` block splitting `stop_preview()`/`stop()`/`close()` into independent `try`/`except`s so cleanup can't be silently skipped). The LED cleanup needs the identical guarantee: **turning the LEDs off must be attempted no matter how the stream session ends** — client disconnects, capture starts, an exception occurs mid-stream, whatever. A dim-but-stuck-on LED ring left running after a preview session ends is a small version of the same class of bug.

## Decision: brightness — 50% during preview, 100% during capture (unchanged)

Same warm-white color (`(255, 255, 200)`) for both — only brightness differs:

- **Capture** (existing, unchanged): `brightness=1.0` (100%) — matches current `colometry.py` behavior exactly, since capture needs consistent, bright, repeatable lighting for accurate RGB measurement.
- **Preview** (new): `brightness=0.5` (50%) — no measurement happens on preview frames, so there's no accuracy requirement pulling this toward 100%. 50% is a clean, easy-to-reason-about "half the power/heat" number given NeoPixel's roughly-linear brightness-to-power relationship (not gamma-corrected in the basic Adafruit library), while still being enough for the operator to see and position a sample.

This value should be a named constant (e.g. `PREVIEW_BRIGHTNESS = 0.5`), not a hardcoded magic number — the actually-correct value depends on real ambient lab lighting, which needs to be verified/tuned on the physical hardware, not decided from a design doc alone.

## Where this lives in code (sketch, not final implementation)

Backend, alongside the streaming endpoint from the encoders doc:

```python
PREVIEW_BRIGHTNESS = 0.5  # tune after testing under real ambient lighting
PREVIEW_COLOR = (255, 255, 200)  # same warm white as capture

# When the preview stream starts:
preview_pixels = neopixel.NeoPixel(board.D18, 7, brightness=PREVIEW_BRIGHTNESS)
preview_pixels.fill(PREVIEW_COLOR)

# When the preview stream stops (client disconnect, capture starting, error — any reason):
try:
    preview_pixels.fill((0, 0, 0))
except Exception:
    pass
```

The capture sequence's existing LED handling in `colometry.py` (`brightness=1`, `fill((255, 255, 200))`, turned off in the hardened `finally` block) stays exactly as-is — no changes needed there. The only new requirement is: **before `process_colometry()` runs**, the preview session (camera stream + preview LEDs) must be confirmed stopped, consistent with the mutual-exclusivity decision already made for the camera itself.

## Decision: separate backend module for preview, not shared with `colometry.py`

`colometry.py` today is one blocking function: open camera, run 5 shots, generate report, close everything, return. Live preview is a structurally different concern — long-running, driven by an HTTP connection's lifetime rather than a single function call, with its own distinct start/stop triggers (client connects/disconnects, capture starting). Rather than folding preview logic into `colometry.py`, it gets its own module (e.g. `backend/live_preview.py`), owning both the camera streaming session *and* the preview-brightness LED session sketched above.

This maps cleanly onto the endpoint split too: `/api/capture` → `colometry.py` (unchanged), new `/api/stream` → `live_preview.py`. One module per endpoint's core logic — each with its own `try`/`finally` cleanup, reasoned about independently instead of one file juggling two different lifecycles.

## Decision: the backend owns stopping preview before capture starts

The sequence is: preview running → operator presses Start Capture → preview stops → `process_colometry()` runs. The question is *who* enforces the "preview stops first" part.

**Backend-owned, not frontend-trusted.** The `/api/capture` handler's very first action — before anything else — calls into `live_preview.py` to force-stop any active preview session (camera + LEDs), regardless of what the frontend did or didn't do. This makes the mutual-exclusivity guarantee structural: it's enforced at the one place that actually matters (you can never end up with two sessions fighting over the camera/LED hardware), rather than depending on the frontend always calling things in the correct order with no race condition.

The frontend can *still* proactively stop the stream too when the button is clicked — nicer UX, the preview visibly cuts out immediately instead of waiting on a round-trip — but the backend must not *rely* on that happening. This needs a small piece of shared state in `live_preview.py`: something like a single "is a preview session currently active, and if so, here's its handle" flag, visible to both the `/api/stream` and `/api/capture` handlers, so `/api/capture` has something concrete to check and tear down.

## Open question for later (not blocking)

Whether the preview's `NeoPixel` instantiation should be its own separate object (as sketched above) or share a single long-lived `NeoPixel` handle that both preview and capture code paths reuse (reconfiguring brightness/fill on each transition instead of creating a fresh instance every time) is an implementation detail to settle once `live_preview.py` actually gets built — doesn't change the design decisions above either way.
