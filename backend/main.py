from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, FileResponse
import subprocess
import os
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change this to your frontend URL for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Define paths
MAIN_OUTPUT_DIR = "history"
IMAGE_DIR = os.path.join(MAIN_OUTPUT_DIR, "captures_image")
HISTOGRAM_DIR = os.path.join(MAIN_OUTPUT_DIR, "histogram")
PDF_DIR = os.path.join(MAIN_OUTPUT_DIR, "pdf")

# Ensure required directories exist
for directory in [MAIN_OUTPUT_DIR, IMAGE_DIR, HISTOGRAM_DIR, PDF_DIR]:
    os.makedirs(directory, exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "Colometry API is running!"}

@app.post("/capture")
def run_colometry():
    """Triggers the colometry process and retrieves the latest results."""
    try:
        # Run the colometry script
        result = subprocess.run(
            ["python3", "coloTEST.py"], capture_output=True, text=True
        )

        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Colometry script failed: {result.stderr.strip()}")

        # Get latest files
        latest_pdf = get_latest_file(PDF_DIR, ".pdf")
        latest_image = get_latest_file(IMAGE_DIR, ".jpg")
        latest_histogram = get_latest_file(HISTOGRAM_DIR, ".png")

        # Validate file existence
        if not latest_pdf or not latest_image or not latest_histogram:
            raise HTTPException(status_code=500, detail="Expected output files not found.")

        return {
            "message": "Colometry process completed successfully.",
            "results": {
                "pdf_url": f"http://localhost:8000/latest_pdf",
                "image_url": f"http://localhost:8000/latest_image",
                "histogram_url": f"http://localhost:8000/latest_histogram"
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_latest_file(directory: str, extension: str) -> Optional[str]:
    """Returns the latest file with the given extension from a directory."""
    try:
        files = sorted(
            [f for f in os.listdir(directory) if f.endswith(extension)], 
            key=lambda x: os.path.getmtime(os.path.join(directory, x)),
            reverse=True
        )
        return os.path.join(directory, files[0]) if files else None
        
    except Exception as e:
        return None

@app.get("/latest_pdf")
def get_latest_pdf():
    """Returns the latest generated PDF file."""
    latest_pdf = get_latest_file(PDF_DIR, ".pdf")
    if not latest_pdf:
        raise HTTPException(status_code=404, detail="No PDF files found.")
    return FileResponse(latest_pdf, media_type="application/pdf", filename=os.path.basename(latest_pdf))

@app.get("/latest_image")
def get_latest_image():
    """Returns the latest captured image."""
    latest_image = get_latest_file(IMAGE_DIR, ".jpg")
    if not latest_image:
        raise HTTPException(status_code=404, detail="No image files found.")
    return FileResponse(latest_image, media_type="image/jpeg", filename=os.path.basename(latest_image))

@app.get("/latest_histogram")
def get_latest_histogram():
    """Returns the latest histogram image."""
    latest_histogram = get_latest_file(HISTOGRAM_DIR, ".png")
    if not latest_histogram:
        raise HTTPException(status_code=404, detail="No histogram files found.")
    return FileResponse(latest_histogram, media_type="image/png", filename=os.path.basename(latest_histogram))

@app.get("/history")
def get_history():
    """Returns a list of all history files (PDFs, images, and histograms)."""
    try:
        pdfs = sorted([f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")], reverse=True)
        images = sorted([f for f in os.listdir(IMAGE_DIR) if f.endswith(".jpg")], reverse=True)
        histograms = sorted([f for f in os.listdir(HISTOGRAM_DIR) if f.endswith(".png")], reverse=True)

        return {
            "pdfs": [{"name": f, "url": f"http://localhost:8000/history/pdf/{f}"} for f in pdfs],
            "images": [{"name": f, "url": f"http://localhost:8000/history/image/{f}"} for f in images],
            "histograms": [{"name": f, "url": f"http://localhost:8000/history/histogram/{f}"} for f in histograms],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

# add serving file    
@app.get("/files/{file_path:path}")
def serve_file(file_path: str):
    file_location = os.path.join(MAIN_OUTPUT_DIR, file_path)
    return FileResponse(file_location)

@app.get("/history/pdf/{filename}")
def get_pdf_history(filename: str):
    """Returns a specific PDF file from history."""
    file_path = os.path.join(PDF_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF file not found.")
    return FileResponse(file_path, media_type="application/pdf", filename=filename)

@app.get("/history/image/{filename}")
def get_image_history(filename: str):
    """Returns a specific image file from history."""
    file_path = os.path.join(IMAGE_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image file not found.")
    return FileResponse(file_path, media_type="image/jpeg", filename=filename)

@app.get("/history/histogram/{filename}")
def get_histogram_history(filename: str):
    """Returns a specific histogram file from history."""
    file_path = os.path.join(HISTOGRAM_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Histogram file not found.")
    return FileResponse(file_path, media_type="image/png", filename=filename)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
