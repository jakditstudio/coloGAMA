# coloGAMA — Production Deployment Plan

Turns coloGAMA from "run two terminal commands manually" into "boots and runs automatically, accessible from any device on the network at `http://<pi-ip>/`."

---

## Overview of changes

1. Backend routes get a clean `/api` prefix (via FastAPI `APIRouter`)
2. Fix hardcoded `localhost:8000` URLs → relative paths
3. Fix camera preview mode for headless operation
4. Drop `sudo`, use proper Linux group permissions instead
5. Build frontend for production (static files, not dev server)
6. nginx serves the frontend + reverse-proxies `/api/` to FastAPI
7. Backend runs as a systemd service (auto-start, auto-restart)
8. Remove old crontab-based auto-start

---

## Step 1 — Rewrite `backend/main.py` with `/api` prefix

Replace the whole file with this version:

```python
import traceback
from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.responses import FileResponse
import os
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from colometry import process_colometry

app = FastAPI()

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change this to your frontend URL for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Everything below is mounted under /api
router = APIRouter(prefix="/api")

# Define paths
MAIN_OUTPUT_DIR = "history"
IMAGE_DIR = os.path.join(MAIN_OUTPUT_DIR, "captures_image")
HISTOGRAM_DIR = os.path.join(MAIN_OUTPUT_DIR, "histogram")
PDF_DIR = os.path.join(MAIN_OUTPUT_DIR, "pdf")

# Ensure required directories exist
for directory in [MAIN_OUTPUT_DIR, IMAGE_DIR, HISTOGRAM_DIR, PDF_DIR]:
    os.makedirs(directory, exist_ok=True)

@router.get("/")
def read_root():
    return {"message": "Colometry API is running!"}

@router.post("/capture")
def run_colometry():
    """Triggers the colometry process and retrieves the latest results."""
    try:
        result = process_colometry()
        return {
            "message": "Colometry process completed successfully.",
            "pdf_url": f"/api/files/pdf/{os.path.basename(result['pdf_filepath'])}",
            "captures": result['captures']
        }
    except PermissionError as e:
        raise HTTPException(status_code=500,
            detail=f"Permission denied. Ensure user is in video/gpio/i2c groups. Error: {str(e)}")
    except Exception as e:
        print(f"Error details: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

def get_latest_file(directory: str, extension: str) -> Optional[str]:
    """Returns the latest file with the given extension from a directory."""
    try:
        files = sorted(
            [f for f in os.listdir(directory) if f.endswith(extension)],
            key=lambda x: os.path.getmtime(os.path.join(directory, x)),
            reverse=True
        )
        return os.path.join(directory, files[0]) if files else None
    except Exception:
        return None

@router.get("/latest_pdf")
def get_latest_pdf():
    latest_pdf = get_latest_file(PDF_DIR, ".pdf")
    if not latest_pdf:
        raise HTTPException(status_code=404, detail="No PDF files found.")
    return FileResponse(latest_pdf, media_type="application/pdf", filename=os.path.basename(latest_pdf))

@router.get("/latest_image")
def get_latest_image():
    latest_image = get_latest_file(IMAGE_DIR, ".jpg")
    if not latest_image:
        raise HTTPException(status_code=404, detail="No image files found.")
    return FileResponse(latest_image, media_type="image/jpeg", filename=os.path.basename(latest_image))

@router.get("/latest_histogram")
def get_latest_histogram():
    latest_histogram = get_latest_file(HISTOGRAM_DIR, ".png")
    if not latest_histogram:
        raise HTTPException(status_code=404, detail="No histogram files found.")
    return FileResponse(latest_histogram, media_type="image/png", filename=os.path.basename(latest_histogram))

@router.get("/history")
def get_history():
    """Returns a list of all history files (PDFs, images, and histograms)."""
    try:
        pdfs = sorted([f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")], reverse=True)
        images = sorted([f for f in os.listdir(IMAGE_DIR) if f.endswith(".jpg")], reverse=True)
        histograms = sorted([f for f in os.listdir(HISTOGRAM_DIR) if f.endswith(".png")], reverse=True)

        return {
            "pdfs": [{"name": f, "url": f"/api/history/pdf/{f}"} for f in pdfs],
            "images": [{"name": f, "url": f"/api/history/image/{f}"} for f in images],
            "histograms": [{"name": f, "url": f"/api/history/histogram/{f}"} for f in histograms],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/files/{file_path:path}")
def serve_file(file_path: str):
    file_location = os.path.join(MAIN_OUTPUT_DIR, file_path)
    return FileResponse(file_location)

@router.get("/history/pdf/{filename}")
def get_pdf_history(filename: str):
    file_path = os.path.join(PDF_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF file not found.")
    return FileResponse(file_path, media_type="application/pdf", filename=filename)

@router.get("/history/image/{filename}")
def get_image_history(filename: str):
    file_path = os.path.join(IMAGE_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image file not found.")
    return FileResponse(file_path, media_type="image/jpeg", filename=filename)

@router.get("/history/histogram/{filename}")
def get_histogram_history(filename: str):
    file_path = os.path.join(HISTOGRAM_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Histogram file not found.")
    return FileResponse(file_path, media_type="image/png", filename=filename)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**What changed vs. your original:**
- Every route now lives on `router = APIRouter(prefix="/api")` instead of `app` directly
- All `http://localhost:8000/...` strings replaced with relative `/api/...` paths
- Logic is otherwise untouched — same behavior, same file structure

---

## Step 2 — Fix `backend/colometry.py` for headless operation

Find this line:
```python
picam2.start_preview(Preview.QTGL)
```

Replace with:
```python
picam2.start_preview(Preview.NULL)
```

**Why:** `QTGL` tries to open a graphical preview window, which requires a display session. Running as a background systemd service, there is no display attached — this would crash or hang the service. `NULL` disables the preview window entirely (nothing was reading from it anyway), letting capture run headless.

No other changes needed in this file — `image_url` and `histogram_url` were already relative paths, correctly written from the start.

---

## Step 3 — Update frontend fetch calls

Wherever the React frontend calls the backend (e.g. `fetch('/capture')`, `fetch('/history')`, or full URLs like `fetch('http://localhost:8000/capture')`), update to the `/api` prefix:

```javascript
// Before (either form)
fetch('/capture')
fetch('http://localhost:8000/capture')

// After
fetch('/api/capture')
```

Do this for every backend call in the frontend codebase — search the `frontend/src` folder for `fetch(` or `axios.` calls and update each one. Also check for any `<img src="...">` or PDF viewer references using the old `image_url`/`pdf_url` values returned from the API — those now come back already prefixed with `/api/`, so just make sure nothing re-adds `http://localhost:8000` on top of them.

---

## Step 4 — Fix permissions (retire `sudo`)

```bash
sudo usermod -aG video,gpio,i2c $USER
sudo reboot
```

After reboot, confirm group membership:
```bash
groups
```
You should see `video`, `gpio`, and `i2c` listed.

---

## Step 5 — Build the frontend for production

```bash
cd ~/Documents/coloGAMA/frontend
npm install
npm run build
```

This creates a `dist/` folder containing static HTML/CSS/JS — no dev server needed at runtime.

---

## Step 6 — Install and configure nginx

```bash
sudo apt update
sudo apt install nginx
```

Create the config file:
```bash
sudo nano /etc/nginx/sites-available/cologama
```

Paste (adjust the `root` path to match your actual username and clone location):
```nginx
server {
    listen 80;
    server_name _;

    root /home/admin/Documents/coloGAMA/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it and disable the default nginx page:
```bash
sudo ln -s /etc/nginx/sites-available/cologama /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

`sudo nginx -t` should say "syntax is ok" / "test is successful" — if it errors, don't restart nginx until it's fixed.

---

## Step 7 — Backend as a systemd service

First, make sure your Python virtual environment exists and has dependencies installed:
```bash
cd ~/Documents/coloGAMA/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn picamera2 opencv-python-headless matplotlib reportlab adafruit-circuitpython-neopixel
deactivate
```

Create the service file:
```bash
sudo nano /etc/systemd/system/cologama-backend.service
```

Paste (adjust `User` and paths to match your actual setup):
```ini
[Unit]
Description=coloGAMA FastAPI Backend
After=network.target

[Service]
Type=simple
User=admin
Group=admin
WorkingDirectory=/home/admin/Documents/coloGAMA/backend
ExecStart=/home/admin/Documents/coloGAMA/backend/.venv/bin/python main.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start it:
```bash
sudo systemctl daemon-reload
sudo systemctl enable cologama-backend
sudo systemctl start cologama-backend
```

Check it's running cleanly:
```bash
sudo systemctl status cologama-backend
```
Should show `active (running)`. If it fails, check logs:
```bash
sudo journalctl -u cologama-backend -f
```

---

## Step 8 — Remove the old crontab auto-start

```bash
crontab -e
```
Delete the line:
```
@reboot /home/admin/start-cologama.sh
```
Save and exit. This is now fully replaced by nginx (frontend) + systemd (backend).

---

## Step 9 — Reboot and test end-to-end

```bash
sudo reboot
```

After it comes back up, find the Pi's IP:
```bash
hostname -I
```

From **any other device** on the same network (phone, laptop), open a browser to:
```
http://<pi-ip-address>/
```

Confirm:
- Frontend loads correctly
- Clicking "Capture" successfully triggers the backend, camera fires, LED lights up, results display
- History page loads past captures
- PDF download/view works

---

## Quick troubleshooting reference

| Symptom | Check |
|---|---|
| Frontend loads but "Capture" fails | `sudo journalctl -u cologama-backend -f` while clicking Capture |
| Blank page / 404 on frontend | Confirm `dist/` exists and nginx `root` path is correct |
| nginx won't start | `sudo nginx -t` for config syntax errors |
| Camera permission errors | Confirm `groups` shows `video`, `gpio`, `i2c`; re-run `usermod` + reboot if not |
| Backend won't start on boot | `sudo systemctl status cologama-backend`, check `WorkingDirectory` and `ExecStart` paths are exact |
| Works from Pi but not from phone | Double-check no `http://localhost:8000` strings remain anywhere in frontend or backend code |

---

## What you get at the end

- Power on the Pi → wait ~30-60s → open `http://<pi-ip>/` from any device on the network → it just works
- No terminal, no manually running scripts, no remembering commands
- Backend auto-restarts if it crashes (`Restart=on-failure`)
- Clean `/api` separation between frontend routes and backend routes — no collision risk, easy to reason about, easy to extend later
