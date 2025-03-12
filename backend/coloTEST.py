import cv2
import matplotlib.pyplot as plt
from reportlab.pdfgen import canvas
import time
import os

def process_colometry():
    main_output_directory = "history"
    image_output_directory = os.path.join(main_output_directory, "captures_image")
    histogram_output_directory = os.path.join(main_output_directory, "histogram")
    pdf_output_directory = os.path.join(main_output_directory, "pdf")

    # Create output directories if they don't exist
    os.makedirs(image_output_directory, exist_ok=True)
    os.makedirs(histogram_output_directory, exist_ok=True)
    os.makedirs(pdf_output_directory, exist_ok=True)


    # output_directory = "history/pdf"

    # prepare pdf file path
    current_datetime = time.strftime("%Y%m%d_%H%M%S")
    pdf_filename = f'output_{current_datetime}.pdf'
    pdf_filepath = os.path.join(pdf_output_directory, pdf_filename)

    # os.makedirs(output_directory, exist_ok=True)

    
    # file_number = 1
    # max_capture_count = 5

    # cap = cv2.VideoCapture(0)  # Open the default laptop webcam
    # cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)  
    # cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

    # pdf = canvas.Canvas(pdf_filepath)

    # while file_number <= max_capture_count:
    #     ret, frame = cap.read()
    #     if not ret:
    #         print("Failed to capture image")
    #         break

    #     timestamp = time.strftime("%Y%m%d_%H%M%S")
    #     filename = f"captured_image_{timestamp}.jpg"
    #     cv2.imwrite(filename, frame)
    #     print(f"Image captured: {filename}")

    #     height, width, _ = frame.shape
    #     crop_width = min(width, 160)
    #     crop_height = min(height, 360)
    #     start_x = (width - crop_width) // 2
    #     start_y = (height - crop_height) // 2
    #     cropped_image = frame[start_y:start_y + crop_height, start_x:start_x + crop_width]

    #     # Plot histogram
    #     plt.clf()
    #     colors = ('b', 'g', 'r')
    #     for i, color in enumerate(colors):
    #         hist = cv2.calcHist([cropped_image], [i], None, [256], [0, 256])
    #         plt.plot(hist, color=color, label=f'{color.upper()} channel')
    #     plt.xlabel('Pixel Intensity')
    #     plt.ylabel('Pixel Count')
    #     plt.title(f'RGB Histogram - Capture {file_number}')
    #     plt.legend()
        
    #     histogram_filename = f"histogram_{timestamp}.png"
    #     plt.savefig(histogram_filename)

    #     B, G, R = cv2.split(cropped_image)
    #     avg_B = int(cv2.mean(B)[0])
    #     avg_G = int(cv2.mean(G)[0])
    #     avg_R = int(cv2.mean(R)[0])

    #     if file_number > 1:
    #         pdf.showPage()

    #     pdf.drawInlineImage(filename, 10, 720 - 40, width=80, height=390)
    #     pdf.drawInlineImage(histogram_filename, 10, 720 - 160, width=400, height=120)
        
    #     pdf.setFont("Helvetica-Bold", 12)
    #     pdf.drawString(10, 720 - 300, f'RGB Values - Capture {file_number}')
        
    #     pdf.setFont("Helvetica", 12)
    #     pdf.drawString(10, 720 - 315, f'R: {avg_R}, G: {avg_G}, B: {avg_B}')

    #     time.sleep(5)
    #     file_number += 1

    # pdf.save()
    # print(f"PDF saved: {pdf_filepath}")

    # # Cleanup temporary files
    # for i in range(1, file_number):
    #     os.remove(f"histogram_{time.strftime('%Y%m%d_%H%M%S', time.localtime(time.time() - i * 5))}.png")
        
    # cap.release()
    # cv2.destroyAllWindows()

    # return pdf_filepath


    file_number = 1
    max_capture_count = 5

    cap = cv2.VideoCapture(0)  # Open the default laptop webcam
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)  
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

    pdf = canvas.Canvas(pdf_filepath)

    while file_number <= max_capture_count:
        ret, frame = cap.read()
        if not ret:
            print("Failed to capture image")
            break

        timestamp = time.strftime("%Y%m%d_%H%M%S")
        image_filename = f"captured_image_{timestamp}.jpg"
        image_filepath = os.path.join(image_output_directory, image_filename)
        cv2.imwrite(image_filepath, frame)
        print(f"Image captured: {image_filepath}")

        height, width, _ = frame.shape
        crop_width = min(width, 160)
        crop_height = min(height, 360)
        start_x = (width - crop_width) // 2
        start_y = (height - crop_height) // 2
        cropped_image = frame[start_y:start_y + crop_height, start_x:start_x + crop_width]

        # Plot histogram
        plt.clf()
        colors = ('b', 'g', 'r')
        for i, color in enumerate(colors):
            hist = cv2.calcHist([cropped_image], [i], None, [256], [0, 256])
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

        if file_number > 1:
            pdf.showPage()

        pdf.drawInlineImage(image_filepath, 10, 720 - 40, width=80, height=390)
        pdf.drawInlineImage(histogram_filepath, 10, 720 - 160, width=400, height=120)
        
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(10, 720 - 300, f'RGB Values - Capture {file_number}')
        
        pdf.setFont("Helvetica", 12)
        pdf.drawString(10, 720 - 315, f'R: {avg_R}, G: {avg_G}, B: {avg_B}')

        time.sleep(5)
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

    cap.release()
    cv2.destroyAllWindows()

    return pdf_filepath



if __name__ == "__main__":
    process_colometry()
