from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, FileResponse
import subprocess
import os


app = FastAPI()

# Define paths
MAIN_OUTPUT_DIR = "history"
IMAGE_DIR = os.path.join(MAIN_OUTPUT_DIR, "captures_image")
HISTOGRAM_DIR = os.path.join(MAIN_OUTPUT_DIR, "histogram")
PDF_DIR = os.path.join(MAIN_OUTPUT_DIR, "pdf")

@app.get("/")
def read_root():
    return {"message": "Colometry API is running!"}

@app.post("/capture")
def run_colometry():
    try:
        # Run the colometry process as an external script
        result = subprocess.run(
            ["python3", "backend/coloTEST.py"], capture_output=True, text=True
        )        
        # Check for errors
        if result.returncode != 0:
            return JSONResponse(content={"error": result.stderr.strip()}, status_code=500)

        latest_pdf = get_latest_file(PDF_DIR, ".pdf")
        latest_image = get_latest_file(IMAGE_DIR, ".jpg")
        latest_histogram = get_latest_file(HISTOGRAM_DIR, ".png")


        if not latest_pdf or not latest_image or not latest_histogram:
            return JSONResponse(content={"error": "Some expected output files were not created."}, status_code=500)

        return {
            "pdf_path": latest_pdf,
            "image_path": latest_image,
            "histogram_path": latest_histogram
        }

    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    
def get_latest_file(directory: str, extension: str) -> str:
    """Returns the latest file with a given extension in a directory."""
    files = sorted(
        [f for f in os.listdir(directory) if f.endswith(extension)], 
        key=lambda x: os.path.getmtime(os.path.join(directory, x)),
        reverse=True
    )
    return os.path.join(directory, files[0]) if files else None

@app.get("/latest_pdf")
def get_latest_pdf():
    latest_pdf = get_latest_file(PDF_DIR, ".pdf")
    if not latest_pdf:
        return JSONResponse(content={"error": "No PDF files found"}, status_code=404)
    return FileResponse(latest_pdf, media_type="application/pdf", filename=os.path.basename(latest_pdf))

@app.get("/latest_image")
def get_latest_image():
    latest_image = get_latest_file(IMAGE_DIR, ".jpg")
    if not latest_image:
        return JSONResponse(content={"error": "No image files found"}, status_code=404)
    return FileResponse(latest_image, media_type="image/jpeg", filename=os.path.basename(latest_image))

@app.get("/latest_histogram")
def get_latest_histogram():
    latest_histogram = get_latest_file(HISTOGRAM_DIR, ".png")
    if not latest_histogram:
        return JSONResponse(content={"error": "No histogram files found"}, status_code=404)
    return FileResponse(latest_histogram, media_type="image/png", filename=os.path.basename(latest_histogram))



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)