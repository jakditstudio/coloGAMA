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

- [ ] Start backend manually (`sudo python main.py`), confirm no import errors
- [ ] Start frontend (`npm run dev -- --host 0.0.0.0`)
- [ ] Open `http://<pi-ip>:5173`, trigger CAPTURE COLOR, confirm 5 captures + PDF generate

## Auto-start (optional, after manual run works)

- [ ] Set up start/stop scripts or systemd — see [coloGAMA-deployment-plan-revised.md](coloGAMA-deployment-plan-revised.md)
