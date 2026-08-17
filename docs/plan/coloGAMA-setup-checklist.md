# coloGAMA — Raspberry Pi Setup Checklist

Picks up after `picamera2` and `adafruit-circuitpython-neopixel` are installed in the venv.

---

## Backend deps (remaining)

- [x] `pip install -r requirements.txt` (already lists fastapi, uvicorn, opencv-python-headless, matplotlib, reportlab, picamera2, neopixel — no need to install separately)
- [x] Pin versions in `requirements.txt` from `pip freeze` — all 7 packages pinned (fastapi, uvicorn, pydantic, opencv-python-headless, matplotlib, reportlab, picamera2, adafruit-circuitpython-neopixel)
- [x] Removed bogus `unittest` line from requirements.txt (stdlib, not a pip package)
- [x] Camera import verified OK
- [x] Backend deps install verified OK

> Note: venv has `include-system-site-packages = true` (needed for libcamera). This means `pip freeze` in this venv also lists the entire Pi OS system Python packages (Thonny, sense-hat, PyQt5, cloud-init, etc) — ignore anything not in `requirements.txt`, that's system noise, not your project's deps.
- [ ] **Recheck pinned versions once program is confirmed running end-to-end** — rerun `pip freeze` after a full successful capture test, diff against pinned `requirements.txt`, make sure nothing drifted/broke silently during setup
- [x] Verify camera import: `python -c "from picamera2 import Picamera2; print('Camera OK')"`
- [x] Verify NeoPixel import: `python -c "import board, neopixel; print('LED OK')"`

### If camera import fails with `ModuleNotFoundError: No module named 'libcamera'`

pip's `picamera2` wheel has no libcamera bindings — those are apt-only, compiled against system `libcamera`.

- [x] `sudo apt install -y python3-picamera2 python3-libcamera`
- [x] Let venv see system packages (no need to recreate venv):
  ```bash
  deactivate
  nano ~/coloGAMA/backend/coloGAMA/pyvenv.cfg
  ```
  Change `include-system-site-packages = false` → `true`, save.
  ```bash
  source ~/coloGAMA/backend/coloGAMA/bin/activate
  ```
- [x] Retest: `python -c "from picamera2 import Picamera2; print('Camera OK')"`
- [x] If still failing, check venv Python version matches system Python version (`python3 --version` vs venv) — mismatch breaks system site-packages linking

## Permissions

- [x] `sudo usermod -aG video,gpio,i2c $USER` (careful: groups are comma-separated, not dot-separated — `video.gpio.i2c` is not a valid group name and will error)
- [x] `sudo chown root:gpio /dev/gpiomem && sudo chmod g+rw /dev/gpiomem`
- [x] Reboot to apply group changes

## Camera enable check

- [x] ~~`vcgencmd get_camera`~~ — unreliable on Pi 5 / Bookworm, camera stack moved fully to libcamera, `Can't open device file: /dev/vcio_gencmd` is expected here, not a real error. Skip this check.
- [x] `rpicam-hello` test — camera detected, working fine (this is the real confirmation)

## Frontend

- [x] `cd ~/coloGAMA/frontend && npm install`
- [x] `npm run build` (test build)

## Run test

> Skipped manual dev-server run — went straight to production setup (systemd + nginx) per [coloGAMA-deployment-plan-revised.md](coloGAMA-deployment-plan-revised.md).

- [x] Backend running as systemd service (`cologama-backend.service`) — `active (running)` confirmed via `sudo systemctl status cologama-backend`
  - Fixed service file: `User`/`Group` were `admin` (placeholder from plan doc, doesn't exist) → corrected to `cologama` (actual Pi user)
  - Fixed `ExecStart` path: had stray `Documents/` inconsistent with `WorkingDirectory` → removed, now `/home/cologama/coloGAMA/backend/coloGAMA/bin/python main.py`
- [x] Set up nginx (Step 6 of deployment plan) — serve frontend `dist/` + reverse-proxy `/api/` to backend
  - Fixed `root` path in `/etc/nginx/sites-available/cologama`: was `/home/admin/...` (unedited plan-doc placeholder) → corrected to `/home/cologama/coloGAMA/frontend/dist`
  - Fixed permission denied on static files: Pi home dirs default `750`, `www-data` (nginx's user) couldn't traverse `/home/cologama/` → `chmod o+x` on `~`, `~/coloGAMA`, `~/coloGAMA/frontend`, plus `chmod -R o+rX` on `dist/`
- [x] Open `http://<pi-ip>/` (port 80 via nginx, not :5173 dev server), trigger CAPTURE COLOR, confirm 5 captures + PDF generate — confirmed working end-to-end
- [x] Confirm History page loads and PDF/image download works through nginx

## Auto-start

- [x] Backend: systemd service (`cologama-backend`), enabled + running
- [x] Frontend: nginx serving `frontend/dist`
- [ ] Remove old crontab `@reboot` line if present (Step 8 of deployment plan) — `crontab -e`, delete `@reboot ~/start-cologama.sh` line
- [ ] Full reboot test — `sudo reboot`, then from another device confirm `http://<pi-ip>/` just works with no manual commands

## NeoPixel LED — `ws2811_init failed with code -9 (Failed to create mailbox device)`

Confirmed on Raspberry Pi 4 Model B Rev 1.5 (`cat /proc/cpuinfo | grep Model`). Not related to nginx — pure hardware permission issue, surfaced specifically because the backend now runs as a normal user under systemd instead of `sudo python main.py`.

`rpi_ws281x` (NeoPixel's underlying driver) needs `/dev/vcio` (VideoCore mailbox, for PWM/DMA timing) — this device defaults to `crw------- root root`, no group access at all, unlike `/dev/gpiomem` which was already opened up earlier.

- [x] Diagnosed: `ls -la /dev/vcio` showed `root:root`, mode `600`
- [x] Immediate fix: `sudo chown root:gpio /dev/vcio && sudo chmod g+rw /dev/vcio`
- [x] Persistent fix (udev rule, survives reboot):
  ```bash
  echo 'SUBSYSTEM=="vcio", GROUP="gpio", MODE="0660"' | sudo tee /etc/udev/rules.d/99-vcio.rules
  sudo udevadm control --reload-rules
  sudo udevadm trigger
  ```
  **Watch the syntax** — `SUBSYSTEM=="vcio"` needs no space between `==` and the quoted value. `SUBSYSTEM== "vcio"` (with a space) silently fails to match and the rule gets ignored — first attempt hit exactly this, confirmed by `ls -la /dev/vcio` still showing `root:root` right after `udevadm trigger` ran.
- [x] Verified: `ls -la /dev/vcio` → `crw-rw---- root gpio`, from the rule itself (not a leftover manual override)
- [x] Backend restarted, `ws2811_init` error gone
