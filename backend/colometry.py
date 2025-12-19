import cv2
import matplotlib.pyplot as plt
from reportlab.pdfgen import canvas
import time
import os

import board
import neopixel
from picamera2 import Picamera2, Preview
from libcamera import controls
from libcamera import Transform

import matplotlib
matplotlib.use('Agg')

def process_colometry():
    output_directory = "history"
    image_output_directory = os.path.join(output_directory, "captures_image")
    histogram_output_directory = os.path.join(output_directory, "histogram")
    pdf_output_directory = os.path.join(output_directory, "pdf")

    # Create output directories if they don't exist
    os.makedirs(image_output_directory, exist_ok=True)
    os.makedirs(histogram_output_directory, exist_ok=True)
    os.makedirs(pdf_output_directory, exist_ok=True)

    # Prepare PDF file path
    current_datetime = time.strftime("%Y%m%d_%H%M%S")
    pdf_filename = f'output_{current_datetime}.pdf'
    pdf_filepath = os.path.join(pdf_output_directory, pdf_filename)

    file_number = 1
    max_capture_count = 5
    
    # store captures data in a list, to be displayed to frontend later
    captures_data = []

    # Initialize Neopixel LED
    pixels1 = neopixel.NeoPixel(board.D18, 7, brightness=1)
    pixels1.fill((255, 255, 200))  # Set initial color

    # Initialize Picamera2
    picam2 = Picamera2()
    
    try:  # Add try-except-finally block
        camera_config = picam2.create_still_configuration(main={"size": (1920, 1080)}, lores={"size": (640, 480)}, display="lores",  transform=Transform(vflip=1))
        picam2.configure(camera_config)
        picam2.set_controls({"AfMode": controls.AfModeEnum.Manual, "LensPosition": 11.})
        
        # Start camera preview
        picam2.start_preview(Preview.QTGL)
        picam2.start()
        
        time.sleep(2)  # Allow the camera to adjust

        pdf = canvas.Canvas(pdf_filepath)

        while file_number <= max_capture_count:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            image_filename = f"captured_image_{timestamp}.jpg"
            image_filepath = os.path.join(image_output_directory, image_filename)

            # Capture image using Picamera2
            picam2.capture_file(image_filepath)
            print(f"Image captured: {image_filepath}")

            # Read the captured image with OpenCV
            captured_image = cv2.imread(image_filepath)
            
            height, width, _ = captured_image.shape
            crop_width = min(width, 160)
            crop_height = min(height, 360)
            start_x = (width - crop_width) // 2
            start_y = (height - crop_height) // 2
            cropped_image = captured_image[start_y:start_y + crop_height, start_x:start_x + crop_width]

            # Plot histogram
            plt.clf()
            colors = ('b', 'g', 'r')
            histogram_data = {}
            
            for i, color in enumerate(colors):
                hist = cv2.calcHist([cropped_image], [i], None, [256], [0, 256])
                color_name = ['blue', 'green', 'red'][i]  # Fixed: proper color names
                histogram_data[color_name] = hist.flatten().tolist()
                plt.plot(hist, color=color, label=f'{color.upper()} channel')
                
            plt.xlabel('Pixel Intensity')
            plt.ylabel('Pixel Count')
            plt.title(f'RGB Histogram - Capture {file_number}')
            plt.legend()

            histogram_filename = f"histogram_{timestamp}.png"
            histogram_filepath = os.path.join(histogram_output_directory, histogram_filename)
            plt.savefig(histogram_filepath)

            B, G, R = cv2.split(cropped_image)
            avg_B = int(cv2.mean(B)[0])
            avg_G = int(cv2.mean(G)[0])
            avg_R = int(cv2.mean(R)[0])
            
            # store capture data
            capture_info = {
                "capture_number": file_number,
                "timestamp": timestamp,
                "image_url": f"/files/captures_image/{image_filename}",
                "histogram_url": f"/files/histogram/{histogram_filename}",
                "rgb_values": {
                    "R": avg_R, 
                    "G": avg_G, 
                    "B": avg_B
                },
                "histogram_data": histogram_data
            }

            captures_data.append(capture_info)

            if file_number > 1:
                pdf.showPage()

            # Draw images and text on PDF
            pdf.drawInlineImage(image_filepath, 10, 720 - 40, width=80, height=390)
            pdf.drawInlineImage(histogram_filepath, 10, 720 - 160, width=400, height=120)

            pdf.setFont("Helvetica-Bold", 12)
            pdf.drawString(10, 720 - 300, f'RGB Values - Capture {file_number}')
            
            pdf.setFont("Helvetica", 12)
            pdf.drawString(10, 720 - 315, f'R: {avg_R}, G: {avg_G}, B: {avg_B}')

            time.sleep(5)  # Wait before the next capture
            file_number += 1

        pdf.save()
        print(f"PDF saved: {pdf_filepath}")

        # Cleanup temporary histogram files after saving to PDF
        for i in range(1, file_number):
            timestamp_to_remove = time.strftime("%Y%m%d_%H%M%S", time.localtime(time.time() - (i * 5)))
            histogram_filename_to_remove = f"histogram_{timestamp_to_remove}.png"
            histogram_filepath_to_remove = os.path.join(histogram_output_directory, histogram_filename_to_remove)

            if os.path.exists(histogram_filepath_to_remove):
                os.remove(histogram_filepath_to_remove)

    finally:  # Always clean up camera resources
        try:
            picam2.stop_preview()
            picam2.stop()
            picam2.close()  # Add this to properly close camera
        except:
            pass
        
        pixels1.fill((0, 0, 0))  # Turn off Neopixel LEDs after processing
    
    return {
        "pdf_filepath": pdf_filepath,
        "captures": captures_data
    }

if __name__ == "__main__":
    process_colometry()
