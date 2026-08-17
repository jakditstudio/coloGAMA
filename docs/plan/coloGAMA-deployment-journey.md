# coloGAMA — Deployment Journey Log

A chronological record of getting coloGAMA running in production on the Raspberry Pi 4 Model B, from dependency install through nginx + systemd going live. Written so the next person (or future us) can see not just *what* broke, but *why*, and skip straight to the fix instead of re-diagnosing from scratch.

Companion docs: [coloGAMA-setup-checklist.md](coloGAMA-setup-checklist.md) (the checkbox version), [coloGAMA-deployment-plan-revised.md](coloGAMA-deployment-plan-revised.md) (the original plan this journey followed), [why-nginx-for-cologama.md](why-nginx-for-cologama.md) (the reasoning for choosing nginx in the first place).

Date: 2026-08-17.

---

## 1. Installing hardware dependencies — three separate native-build failures

Installing `adafruit-circuitpython-neopixel` and `picamera2` in the venv hit a chain of missing system dependencies, one at a time:

**`lgpio` wheel build failed — missing `swig`:**
```
error: command 'swig' failed: No such file or directory
```
Fix: `sudo apt install -y swig libcap-dev python3-dev`

**`lgpio` failed again — this time at the link step:**
```
/usr/bin/ld: cannot find -llgpio: No such file or directory
```
`swig` only generates the Python wrapper — it still needs the actual `liblgpio` C library installed to link against. Fixed via `liblgpio-dev` (or building `lg` from source if the package wasn't available).

**`python-prctl` failed — missing libcap headers:**
```
You need to install libcap development headers to build this module
```
Already covered by the `libcap-dev` installed above.

**Lesson**: pip build errors on the Pi are almost always missing *system* packages, not a broken venv. Read the actual compiler/linker error, not just "pip install failed."

---

## 2. `picamera2` import fails — `ModuleNotFoundError: No module named 'libcamera'`

```python
from picamera2 import Picamera2
# ModuleNotFoundError: No module named 'libcamera'
```

**Cause**: pip's `picamera2` wheel has no libcamera bindings — those are apt-only, compiled against the system's `libcamera`. Installing `picamera2` via pip alone can never work standalone.

**Fix**:
```bash
sudo apt install -y python3-picamera2 python3-libcamera
```
Then let the venv see system-installed packages (edit `pyvenv.cfg`, `include-system-site-packages = false` → `true`) instead of recreating the venv from scratch.

**Side effect**: with system-site-packages enabled, `pip freeze` inside the venv now also dumps the *entire* Pi OS system Python environment (Thonny, sense-hat, PyQt5, cloud-init, hundreds of `types-*` stub packages, etc). Not a bug — just noise to filter out mentally when reading `pip freeze` output from here on.

---

## 3. Unpinned `requirements.txt` — surprise re-downloads and upgrades

Running `pip install fastapi uvicorn ...` a second time re-resolved and re-downloaded packages that were already installed, because nothing in `requirements.txt` was version-pinned — every install re-resolves against whatever's latest on PyPI/piwheels that day.

**Fix**: pinned all 7 real dependencies from `pip freeze` output (`fastapi==0.141.1`, `uvicorn==0.52.3`, `pydantic==2.13.4`, `opencv-python-headless==5.0.0.93`, `matplotlib==3.11.1`, `reportlab==5.0.0`, `picamera2==0.3.37`, `adafruit-circuitpython-neopixel==6.4.2`). Also removed a bogus `unittest` line — that's a Python stdlib module, not something `pip install`s.

---

## 4. Small setup slip-ups

- `sudo usermod -aG video.gpio.i2c $USER` — used **dots** instead of **commas** as group separators (`usermod: group 'video.gpio.i2c' does not exist`). Groups must be comma-separated: `video,gpio,i2c`.
- `vcgencmd get_camera` → `Can't open device file: /dev/vcio_gencmd`. Looked alarming but is expected/harmless on Pi 4 running current Bookworm — the camera stack has moved to libcamera and this legacy VideoCore firmware query doesn't reliably work anymore. `rpicam-hello` is the real, definitive camera check — confirmed working fine.

---

## 5. Frontend: npm audit findings and a corrupted reinstall

`npm install` reported 17 vulnerabilities (3 low, 3 moderate, 11 high). On inspection, almost all were dev-tooling (babel, eslint, vite/esbuild, rollup, postcss, etc) — never shipped to the browser. The one real runtime dependency flagged was `react-router`/`react-router-dom`, and most of *those* CVEs were SSR/server-action specific, not applicable to this plain client-side SPA. All fixes were available via plain `npm audit fix` (no `--force`, i.e. semver-safe).

Running `npm audit fix` then hit:
```
npm ERR! code ENOTEMPTY
npm ERR! ENOTEMPTY: directory not empty, rename '.../node_modules/ajv' -> '.../node_modules/.ajv-xxxx'
```
A stale/partially-installed `node_modules` state. Fixed with a clean reinstall:
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm audit fix
npm run build
```

---

## 6. Build warning: 820KB JS bundle

`npm run build` succeeded but warned about a 820KB (258KB gzip) chunk. Root cause: every route (`Hero`, `Results`, `History`) is statically imported in `App.jsx`, so visiting `/` downloads chart.js and react-pdf too, even though only `/results` and `/history` need them.

**Decision**: not worth fixing right now. This is a LAN-only Pi app, loaded by a handful of users over local wifi — 820KB loads in under a second there, it's a one-time cost, and route-level code-splitting (`React.lazy` + `Suspense`) would add real complexity (a new failure mode: lazy chunk fetches can fail mid-session on flaky wifi) for a problem that isn't actually hurting anyone yet. Documented as a future option, not implemented.

---

## 7. `frontend/src/service/api.js` — dead code with a real bug, then wired up

Reviewing the file against [coloGAMA-deployment-plan-revised.md](coloGAMA-deployment-plan-revised.md) Step 3.5 found:

1. **`apiRequest` never returned anything.** `response` was declared inside the `try` block and never returned — every successful call implicitly returned `undefined`, which would crash any caller doing `response.json()`. Invisible until now because **nothing imported this file** — `Hero.jsx`, `Results.jsx`, `History.jsx` all called raw `fetch()` directly with duplicated try/catch blocks instead.
2. Fixed `apiRequest` to properly return the response and check `.ok`, extracting `detail` from error responses.
3. Wired all three components to use `triggerCapture()` / `getHistory()` from the shared helper instead of raw `fetch`.
4. Replaced `Hero.jsx`'s blocking `alert("Capture failed!")` with an inline error banner, matching the "friendly message instead of a dead page" UX the plan called for.

---

## 8. Backend as a systemd service — two rounds of placeholder-path failures

**Round 1:**
```
Failed to determine user credentials: No such process
Failed at step USER spawning /home/admin/.../python: No such process
status=217/USER
```
`User=admin` / `Group=admin` in the service file was an unedited placeholder from the deployment plan doc — that user doesn't exist on this Pi. Actual user is `cologama`.

**Round 2**, after fixing the user:
```
Unable to locate executable '/home/cologama/Documents/coloGAMA/backend/coloGAMA/bin/python': No such file or directory
status=203/EXEC
```
`ExecStart` still had a stray `Documents/` segment that `WorkingDirectory` didn't have — inconsistent, and the actual repo path has no `Documents/` in it. Removed it.

**Result**, after both fixes:
```
Active: active (running)
```

**Lesson, twice now**: every templated `admin` / `/home/admin/...` in the plan doc needs to be swapped for the real username and the real clone path — and both need to match *each other* exactly, not just be "close enough."

---

## 9. nginx — two rounds of 500 errors

**Round 1**: `curl -I http://localhost/` → `500 Internal Server Error`. Error log:
```
rewrite or internal redirection cycle while internally redirecting to "/index.html"
```
Same root cause as the systemd issue — `root /home/admin/coloGAMA/frontend/dist;` was still the unedited placeholder. `try_files` couldn't find `index.html` at that (nonexistent) path, so it looped trying to serve `/index.html` as its own fallback, forever. Fixed the path to the real user.

**Round 2**: still `500` after fixing the path. Error log this time:
```
[crit] stat() "/home/cologama/coloGAMA/frontend/dist/index.html" failed (13: Permission denied)
```
Pi OS defaults home directories to `750` — nginx runs as `www-data`, which isn't `cologama` or in their group, so it couldn't even traverse into `/home/cologama/` to reach `dist/`, regardless of the path being correct. Fixed:
```bash
chmod o+x ~ ~/coloGAMA ~/coloGAMA/frontend
chmod -R o+rX ~/coloGAMA/frontend/dist
```
`curl -I http://localhost/` → `200 OK`. Confirmed `/api/` proxy working too, then full end-to-end test from another device on the network: capture, results, history, PDF download — all working through nginx + systemd.

---

## 10. Phone hotspot access + `raspberrypi.local`

Set up a dedicated phone hotspot (SSID `cologama`, password `cologama123`) for field/remote use, and worked through what happens if the Pi later connects to a *different* phone broadcasting the identical SSID+password:

- **Hostname** (`raspberrypi`) never changes — it's a Pi-local setting, unrelated to which network it's on.
- **IP address** is not guaranteed to stay the same — each phone runs its own independent DHCP server, even with identical SSID+password.
- Since the two hotspots are indistinguishable to the Pi (same SSID+password), it will auto-reconnect to whichever is present without knowing or caring that it's a different physical phone.

**Fix for the IP-instability problem**: use `http://raspberrypi.local/` (mDNS/Avahi) instead of a raw IP anywhere in docs, bookmarks, or scripts. `avahi-daemon` on the Pi answers local multicast queries for its own name live, every time — no caching, no dependency on which network or IP it currently has. Tested working across an actual hotspot swap. Readme's "Accessing the Interface" section now leads with `.local`, with the IP (`hostname -I`) documented only as a fallback for devices with poor mDNS support.

---

## 11. NeoPixel LED — `ws2811_init failed with code -9 (Failed to create mailbox device)`

Initially suspected nginx or a physical wiring issue — it was neither. Confirmed hardware first: `cat /proc/cpuinfo | grep Model` → **Raspberry Pi 4 Model B Rev 1.5** (settling an earlier discrepancy — the readme's hardware table claims Pi 5, which would have needed a completely different fix path, since Pi 5 doesn't support this mailbox-based driver at all).

**Root cause**: `rpi_ws281x` (NeoPixel's underlying driver) needs `/dev/vcio` — the VideoCore mailbox device, for PWM/DMA-precision LED timing. This surfaced now specifically *because* the backend was switched from `sudo python main.py` to running as a normal user under systemd (per the deployment plan's "retire sudo" step) — root access had been silently covering for this the whole time. `/dev/gpiomem` permissions were already fixed earlier in this process; `/dev/vcio` never was.

```bash
ls -la /dev/vcio
# crw------- 1 root root 10, 257 ...   ← root-only, no group access at all
```

**Immediate fix** (resets on reboot):
```bash
sudo chown root:gpio /dev/vcio
sudo chmod g+rw /dev/vcio
```

**Persistent fix** (udev rule) — first attempt had a subtle syntax bug:
```
SUBSYSTEM== "vcio", GROUP="gpio", MODE="0660"
```
The space between `==` and `"vcio"` breaks udev's tokenizer — the rule silently fails to match and gets ignored, with no error printed. Confirmed by `ls -la /dev/vcio` still showing `root:root` immediately after `udevadm trigger` supposedly applied it. Corrected (no space):
```bash
echo 'SUBSYSTEM=="vcio", GROUP="gpio", MODE="0660"' | sudo tee /etc/udev/rules.d/99-vcio.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```
Verified: `crw-rw---- root gpio`, from the rule itself. Backend restarted, `ws2811_init` error gone.

---

## What's still open

- [ ] Remove the old crontab `@reboot` auto-start line, if one still exists from before the systemd/nginx switch (`crontab -l` to check, `crontab -e` to remove)
- [ ] Full cold-boot test (`sudo reboot`, confirm everything comes up unattended)
- [ ] Recheck `requirements.txt` pins once more against `pip freeze` now that everything (including the vcio fix) is confirmed working end-to-end
- [ ] Readme hardware table says "Raspberry Pi 5" / "ArduCam IMX519 (16MP)" — now hard-confirmed Pi 4 Model B via `/proc/cpuinfo`; hardware table still not corrected

See [coloGAMA-setup-checklist.md](coloGAMA-setup-checklist.md) for the live, checkbox-tracked version of all of the above.
