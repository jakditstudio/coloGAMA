# Why I chose nginx for coloGAMA — my own notes

## The one-breath answer (say this first)

> nginx puts serving the webpage in a separate process from my backend logic. If the backend crashes or hangs — which is a real risk here because it does direct hardware access — the page stays up and can show a clear error instead of going dark.

That's the whole answer. Everything below is just the reasoning underneath it, for when someone asks "why does that matter" or "why here specifically."

---

## The core mechanism: process isolation

nginx and my FastAPI backend run as **two separate OS processes**. They don't share memory, a call stack, or a lifecycle. nginx's only job is: read files off disk (`frontend/dist/`) and hand them to browsers, or forward `/api/*` requests to the backend and relay the response.

Because they're separate processes, a failure in one **cannot directly kill the other**. If the backend process dies, nginx doesn't know or care — it just gets a connection-refused error next time it tries to proxy to port 8000, and returns a `502` for that one request. It keeps serving the actual page normally the whole time.

If I *didn't* use nginx — i.e. FastAPI/uvicorn serves the built frontend directly — then there's only **one process** doing both jobs. A failure in the camera logic can take the whole process down, page included.

---

## Why this matters *specifically* for coloGAMA (not just "best practice")

Most backend code only touches software — databases, JSON, business logic. When that fails, Python raises a normal exception, FastAPI turns it into a clean `500` response, and the process survives to handle the next request. Gentle failure.

My `colometry.py` is different: it reaches past Python into actual hardware —

- `Picamera2()` → talks to the camera's kernel driver (the same `arducam_64mp.ko` driver I spent hours debugging — wrong kernel version, DKMS build, bad cable, `Input/output error`, kernel-level `WARNING` traces in `dmesg`)
- `neopixel.NeoPixel(board.D18, ...)` → talks directly to a GPIO pin

This kind of failure can happen in **two ways that are worse than a normal Python exception**:

1. **Hang** — Python normally runs one thing at a time on the main thread. If `picam2.start()` gets stuck retrying against a flaky driver, the *entire process* is blocked — including serving the frontend — because there's nothing else running to hand out `index.html` in the meantime.
2. **Crash** — if the driver-level failure is bad enough (a segfault, a fatal kernel error — like the actual `videobuf2_core.c` kernel WARNING trace I saw in `dmesg` during troubleshooting), the OS can kill the whole process outright. Not "the request failed" — the *process is gone*. Nothing is left running to serve anything, page included.

Both failure modes are things Python's own `try/except` can't fully protect against, because the failure isn't happening inside Python — it's happening in the C library / kernel driver underneath it.

**The key point:** I already have direct proof this specific hardware misbehaves in unpredictable ways (documented across this whole debugging session — wrong kernel, driver mismatch, then eventually traced to a bad cable). Treating "the camera subsystem might hang or crash the process" as a real, non-theoretical risk isn't paranoia for this project — it's a response to evidence I already have.

---

## What I get, concretely, by separating them

| Without nginx (one process) | With nginx (two processes) |
|---|---|
| Camera hang → whole page hangs too | Camera hang → page still loads, only the Capture action fails |
| Camera crash → whole page goes dark, nothing served | Camera crash → page still loads normally |
| User sees a blank tab / spinner with no explanation | User sees a plain-language message: "camera service isn't responding" (Step 3.5 in the deployment plan) |
| Recovery = whole site was down the entire time | Recovery = only API calls were down; frontend never blinked |

---

## What nginx does *not* give me here (to stay honest)

- It's **not** about raw performance or scale — my traffic (a few devices on a local network) is nowhere near where nginx's serving efficiency would actually matter.
- It's **not** required for the IoT/multi-device accessibility — that comes from binding uvicorn to `0.0.0.0` and fixing hardcoded `localhost` URLs, which I'd need regardless of nginx.
- The only "cosmetic" thing it buys is a clean URL (`http://<ip>/` on port 80 instead of `http://<ip>:8000`) — nice, but not the real reason.

The real reason is failure isolation, full stop. Keeping this section here so I don't accidentally overstate the case later and get caught out by a follow-up question.

---

## If someone pushes further

**"How much traffic are you actually expecting?"**
→ Very little — a handful of devices on a local network. That's honestly the truth, and it's fine, because raw performance was never the reason I chose nginx.

**"Why not just wrap the camera calls in try/except?"**
→ I do, at the Python level (see the `try/finally` in `colometry.py`). But that only catches clean Python exceptions. It doesn't protect against a hang (process blocked waiting on hardware) or a hard crash from a driver-level fault below Python's reach — which is exactly the category of failure I actually hit while getting this camera working in the first place.

**"Isn't this overkill for a single Raspberry Pi project?"**
→ Fair to ask. It would be overkill if the backend only did typical CRUD work. It's proportionate here specifically because the backend does direct hardware access with a documented history of unpredictable failure on this exact device.
