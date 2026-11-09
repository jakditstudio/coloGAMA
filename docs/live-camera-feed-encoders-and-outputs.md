# Picamera2 Encoders & Outputs — Choosing the Right Combo for a Positioning-Preview Live Feed

Reference doc written while designing the Dashboard's live camera preview (currently a static placeholder in `Dashboard.jsx`). Goal: explain what Picamera2's encoder/output options actually are, and why one specific combination fits coloGAMA's use case — a short, low-stakes positioning preview shown before a capture, not video recording or long-range streaming.

---

## The core architectural idea: Encoder and Output are separate, composable pieces

Picamera2's streaming/recording API splits the problem into two independent concerns, mixed and matched:

- **Encoder** — compresses raw frames coming off the camera sensor into some codec. This is a CPU/hardware-accelerated compression step, nothing to do with *where the data goes*.
- **Output** — decides what happens to the encoded bytes once produced: written to a file, piped to `ffmpeg`, kept in a rolling in-memory buffer, or handed to your own Python code (e.g., to serve over HTTP).

Any encoder can in principle pair with any output. Your job is picking the right encoder for the *compression* tradeoff, and the right output for the *delivery* tradeoff, independently.

---

## Encoders

### `JpegEncoder` (Motion JPEG)

Compresses each frame independently as a standalone JPEG image — no relationship between consecutive frames, no inter-frame compression.

- **Pros**: dead simple, low CPU cost on a Pi (JPEG encode is cheap and often hardware-assisted), every single frame is immediately usable/valid on its own (no keyframe dependency), and critically — **every web browser can display a JPEG natively with zero extra software**. This is what makes it pair so well with a trivial delivery mechanism (see MJPEG-over-HTTP below).
- **Cons**: no inter-frame compression means larger total bandwidth per second of video compared to H264 at the same visual quality — irrelevant on a local network for a small preview frame, would matter a lot if you were streaming full-res video over the public internet.

### `H264Encoder`

Real video codec — encodes frames with both intra-frame (JPEG-like) and inter-frame (temporal, "only send what changed since the last frame") compression, hardware-accelerated on the Pi's VideoCore GPU.

- **Pros**: far better compression ratio for the same visual quality — the right choice when bandwidth is scarce (streaming over the internet, saving to storage long-term, recording hours of footage).
- **Cons**: an H264 *bitstream* is not something a browser can just display by pointing an `<img>` or even a plain `<video>` tag at a raw stream of bytes — it needs to be wrapped in a container/transport that the browser understands: HLS (chunked `.ts`/`.m4s` segments + a manifest, adds multi-second latency by design), RTSP (needs a dedicated media server and usually a non-browser player), WebRTC (lowest latency of the three, but requires a signaling server and a much heavier server-side stack — e.g. `aiortc` in Python). Every one of these paths adds real infrastructure and at least one new frontend dependency.

### Other encoders (mentioned for completeness, not relevant here)

Picamera2 also exposes encoders for other codecs (e.g., MPEG variants via `libav`-backed encoders) aimed at specific compatibility/storage needs. None of them change the fundamental H264-style tradeoff above: better compression, harder to get into a browser without extra plumbing.

---

## Outputs

### A custom `StreamingOutput` (in-memory buffer + condition variable)

This isn't a single built-in class you import — it's a small pattern Picamera2's own documentation demonstrates: a Python object with a `write()` method (called by the encoder every time a new frame is ready) that stores the latest frame bytes and notifies any waiting readers via a `threading.Condition`. Your web server's request handler waits on that condition, and as soon as a new frame lands, writes it out to the HTTP response.

- **Why it fits here**: this is the standard building block for "give me each frame as it's produced, over a live HTTP connection" — exactly a browser-facing live preview. No file I/O, no subprocess, minimal latency (a frame is forwarded the instant it's encoded).

#### Reference examples — and what needs to change before either fits this project

Two example files turned up during research, both worth knowing about:

**`backend/tests/stream-example2.py` — the authoritative one.** This is the actual official `picamera2` streaming example (`from picamera2 import Picamera2`, `from picamera2.encoders import JpegEncoder`, `from picamera2.outputs import FileOutput`) — confirms the camera-side API guessed above word-for-word:
```python
picam2.configure(picam2.create_video_configuration(main={"size": (640, 480)}))
output = StreamingOutput()
picam2.start_recording(JpegEncoder(), FileOutput(output))
```
Its `StreamingOutput` is also simpler than the older example below:
```python
class StreamingOutput(io.BufferedIOBase):
    def __init__(self):
        self.frame = None
        self.condition = Condition()

    def write(self, buf):
        with self.condition:
            self.frame = buf
            self.condition.notify_all()
```
No manual buffering or JPEG-marker detection needed — `picamera2`'s `FileOutput`+`JpegEncoder` already calls `.write()` once per *complete* encoded frame, not raw partial chunks. This is the version to actually work from.

**`backend/tests/stream-example.py` — legacy reference only.** Sourced from the *old* `picamera` (v1) docs (`picamera.readthedocs.io`), not `picamera2`. Its `StreamingOutput` does its own `io.BytesIO()` buffering + `\xff\xd8` JPEG-start-marker detection to reconstruct frame boundaries manually — necessary there because the legacy `picamera` library's `write()` delivers raw stream chunks, not whole frames. Confirms the same conceptual pattern, but more complex than necessary for this project since `picamera2` solves the frame-boundary problem for you.

**One thing both examples get wrong for this project, identically**: both spin up their own standalone `http.server`/`socketserver.ThreadingMixIn` server on its own port (`8000` in both examples — notably the same port your actual FastAPI backend already listens on). This project already has FastAPI/uvicorn serving everything, proxied through nginx at `/api/` — a second raw HTTP server would need its own port and its own nginx `location` block, duplicating infrastructure that already exists for no benefit. The correct translation is a FastAPI route returning a `StreamingResponse` with `media_type="multipart/x-mixed-replace; boundary=FRAME"`, reading from the same `StreamingOutput.frame`/`.condition` — identical delivery mechanism (multipart JPEG chunks over one long-lived HTTP connection), served from the app that already exists instead of standing up a second one.

Net: take `stream-example2.py`'s `picamera2`-native encoder/output/`StreamingOutput` code as the actual reference; replace its `StreamingHandler`/`StreamingServer`/`socketserver` delivery mechanism with a FastAPI route. Keep `stream-example.py` around only as background on why the simpler `picamera2` version works the way it does.

### `FileOutput`

Writes encoded data straight to a file (or a file-like object) on disk.

- **Fits**: local recording to storage. Not what a positioning preview needs — you don't want every preview frame ever shown to accumulate as saved files.

### `FfmpegOutput`

Pipes encoded frames into an `ffmpeg` subprocess, which can then mux/transcode into other formats or push to a streaming protocol (RTMP, HLS segments, etc).

- **Fits**: when you need format conversion or a protocol `ffmpeg` handles for you. Adds a whole extra process to manage, monitor, and clean up — meaningful operational weight for a feature whose entire job is "small preview thumbnail before you press a button."

### `CircularOutput`

An in-memory ring buffer that continuously overwrites itself, keeping only the last N seconds of encoded video. The typical use is motion-triggered recording: keep recording into the ring buffer always, and when some event fires, flush the last few seconds (before *and* after the event) to a file — "what happened right before this thing triggered."

- **Fits**: security-camera-style event recording. coloGAMA has no such requirement — there's no "trigger" to capture footage around, just an operator looking at a live view before manually pressing Capture.

---

## The recommended combination for coloGAMA: `JpegEncoder` + custom `StreamingOutput`

This is Picamera2's own documented pattern for exactly this scenario (their examples call it `mjpeg_server.py`-style streaming) — serving each JPEG frame as it's produced, over an HTTP connection using the `multipart/x-mixed-replace` content type. The browser side is as simple as:

```html
<img src="/api/stream" />
```

No `<video>` tag, no `hls.js`/`dash.js`/WebRTC library, no manifest files, no segmenting delay. The image just keeps updating itself as new multipart chunks arrive — this *is* the "MJPEG stream" pattern that's been a staple of embedded-camera web UIs (security cameras, 3D printer webcams, etc) for over a decade, precisely because of this simplicity.

### Why not H264 here, concretely

| | MJPEG (JpegEncoder) | H264 (H264Encoder) |
|---|---|---|
| Browser display | Native `<img>` tag, zero extra libraries | Needs HLS/RTSP/WebRTC wrapper + a JS library |
| Latency | Near-instant (no buffering/segmenting) | HLS: multi-second by design. WebRTC: low, but needs a signaling server |
| Server complexity | One HTTP endpoint + a small Python class | A transcoding/streaming service, likely a subprocess to manage |
| Bandwidth efficiency | Lower (irrelevant on LAN, small frame) | Higher (matters over the internet or at scale) |
| New dependencies | None on the frontend | At least one JS streaming library, possibly a media server |

Given the actual requirement — a small preview frame, viewed on the same local network, purely to help position a sample before pressing Capture, not recorded or streamed off-site — MJPEG wins on every axis that matters here. H264's real advantage (bandwidth efficiency at scale) isn't a constraint coloGAMA has.

---

## The one architectural wrinkle: camera contention

Picamera2 represents the camera as a single resource — only one open `Picamera2()` session can hold it at a time. Today, `colometry.py` opens a fresh `Picamera2()` only for the ~30-second duration of an actual capture sequence, then fully closes it (see the `finally` block's `stop()`/`close()` calls). A live preview needs the camera open continuously while the Dashboard page is being viewed — a live stream and the capture sequence can't both hold the camera open simultaneously without explicit coordination.

Decision (per the brainstorming discussion): since the preview's only purpose is positioning *before* a capture, the stream and the capture sequence are **mutually exclusive**, not concurrently shared. Starting a capture stops the live stream first, runs the existing 5-shot sequence unchanged, and the stream can be restarted afterward. This avoids building a more complex persistent camera-session manager that would have to safely hand the camera back and forth between a lightweight streaming config and the still-capture config — extra risk for a benefit (an uninterrupted feed during/after capture) that doesn't actually matter for this use case.

---

## Deep dive: custom `StreamingOutput` vs `FfmpegOutput`

Both were on the table, so worth actually weighing them against each other rather than just picking one by default.

### Process model

- **`StreamingOutput`**: pure Python, runs *inside* the FastAPI/uvicorn process. The encoder calls `.write()` on your object directly, in-memory, no serialization boundary crossed.
- **`FfmpegOutput`**: spawns and manages a separate `ffmpeg` **subprocess**, piping encoded bytes to its stdin. Your Python process now owns the lifecycle of an external process — starting it, feeding it, detecting if it dies, cleaning it up on shutdown.

This is the single biggest practical difference and it cascades into everything below.

### Complexity & moving parts

- **`StreamingOutput`**: maybe 20-30 lines of Python (a class with `write()`, a `threading.Condition`, a FastAPI generator function reading from it). No new system dependency — `ffmpeg` doesn't even need to be installed on the Pi for this path.
- **`FfmpegOutput`**: requires `ffmpeg` installed as a system package, and now your backend has a subprocess dependency that can fail independently of your Python code — wrong `ffmpeg` version, missing codec support in the distro's build, the subprocess hanging or zombie-ing if not reaped correctly, stdout/stderr buffering deadlocks if not piped carefully. None of this is exotic, but it's real operational surface area a pure-Python output doesn't have.

### Latency

- **`StreamingOutput`**: a frame goes from "encoder produced it" to "written to the HTTP response" with essentially no intermediate step — you control the exact hand-off.
- **`FfmpegOutput`**: adds at least one extra hop (Python → pipe → ffmpeg → wherever ffmpeg sends it next), plus whatever internal buffering `ffmpeg` itself does before flushing. Usually still fast, but it's a layer you don't control as tightly, and debugging "why did this frame take 200ms longer" now spans two processes instead of one.

### What each actually *enables*

This is where `FfmpegOutput` earns its keep, if you ever need it:

- **Format/protocol conversion**: `ffmpeg` can take the H264 (or other) stream and mux it into virtually anything — HLS segments, RTSP, RTMP to a streaming service, a properly-muxed `.mp4` file. `StreamingOutput` gives you exactly the raw encoded bytes and nothing else; any conversion is on you to implement (or you don't need conversion at all, which is coloGAMA's case with plain MJPEG).
- **Simultaneous multi-destination output**: `ffmpeg` can fan a single encoded stream out to multiple outputs (e.g., save to file *and* push to a streaming endpoint) in one invocation. Doing that with `StreamingOutput` means writing that fan-out logic yourself (not hard, but not free either).
- **Codec flexibility for delivery**: if you ever move to H264 (e.g., wanting a lower-bandwidth remote view over the internet, not just LAN), `ffmpeg` is the natural tool for wrapping it into something a browser can consume (HLS). A hand-rolled `StreamingOutput` would need to reimplement that segmenting/muxing logic yourself, which is a lot more work than it sounds — this is genuinely `ffmpeg`'s home turf.

### Resource usage on a Pi specifically

- **`StreamingOutput`**: no extra process, no extra memory footprint beyond your own buffer (which for MJPEG is just "one JPEG frame at a time," trivially small).
- **`FfmpegOutput`**: a whole second process running alongside your Python backend, with its own memory/CPU footprint. On a Pi already juggling the camera pipeline, NeoPixel control, and the web backend, an extra always-running subprocess is a real (if usually modest) resource cost worth being aware of, not hypothetical.

### Failure modes

- **`StreamingOutput`**: failures happen inside your own process — a client disconnecting, a slow reader, an exception — all visible directly in your existing Python error handling/logging, same as everything else in `main.py`. This project already has real, hard-won experience with a camera-cleanup bug (the `try/except` split-up from the stuck-camera-lock incident) — keeping the streaming path in the same process, same error-handling patterns, means that lesson directly applies here too.
- **`FfmpegOutput`**: a hung or crashed `ffmpeg` subprocess is a *different class* of failure — it can leave the pipe in a bad state, requires explicit process-health monitoring to detect, and if not cleaned up properly on backend restart could itself become a "stuck resource" problem, similar in spirit to (though separate from) the camera-lock issue already solved once this session.

### Bottom line for coloGAMA specifically

Given the confirmed use case (MJPEG, LAN-only, positioning preview, no recording, no remote/bandwidth-constrained viewing today) — `StreamingOutput` wins on every axis that currently matters: fewer moving parts, lower latency, no new system dependency, failures stay inside the process you already know how to debug. `FfmpegOutput`'s real advantages (format conversion, multi-destination fan-out, H264/HLS for remote viewing) are all *future* capabilities you're not asking for right now — worth remembering as an option if a later requirement genuinely needs them (e.g. "I want to check the live feed from my phone over the internet, not just LAN"), but not a reason to take on the complexity today.

---

## Summary

- **Encoder: `JpegEncoder`** — cheap, browser-native, no inter-frame dependency.
- **Output: custom `StreamingOutput`** (buffer + condition variable) → served via a FastAPI `StreamingResponse` as `multipart/x-mixed-replace`.
- **Frontend: plain `<img src="/api/stream" />`** — no new dependencies.
- **Camera lifecycle: mutually exclusive with capture** — stream stops when a capture starts, existing capture logic in `colometry.py` untouched.

This keeps the live-feed feature small, dependency-free on the frontend, and avoids re-touching the camera-lifecycle code that already caused real debugging pain earlier in this project (the stuck-camera-lock incident from the `stop_preview()`/`stop()`/`close()` cleanup bug).
