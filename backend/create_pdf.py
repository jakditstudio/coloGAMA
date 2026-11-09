from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.units import mm
import time

import os

# this module is for creating pdf file from the captured images and histogram data
# A PROPER PDF REPORT OF COURSE
# with proper formatting and layout, not just dumping images and text
class  PDFCreator:
    # main function to create pdf report from the captured data
    @staticmethod 
    def create_pdf(captures_data, output_directory):
        current_datetime = time.strftime("%Y%m%d_%H%M%S")
        pdf_filename = f'colometry_report_{current_datetime}.pdf'
        pdf_filepath = os.path.join(output_directory, pdf_filename)
        history_directory = "history"

        doc = SimpleDocTemplate(pdf_filepath, pagesize=letter)
        doc.title = "Colometry Report"
        # styles = getSampleStyleSheet()
        story = [] 

        # define custom styles
        title_style = ParagraphStyle(
            name='Title', 
            fontSize=16, 
            leading=20, 
            alignment=TA_CENTER
        )
        
        info_style = ParagraphStyle(
            name='Info', 
            fontSize=12, 
            leading=15, 
            alignment=TA_LEFT
        )

        font = 'Times-Roman'  # You can choose other fonts like 'Helvetica', 'Courier', etc.
        title_style.fontName = font
        info_style.fontName = font


        # add title 
        story.append(Paragraph("Colometry Capture Report", title_style))
        story.append(Spacer(5, 30))
        
        for capture in captures_data:
            # Add capture information
            story.append(Paragraph(f"Capture {capture['capture_number']} - {capture['timestamp']}", info_style))
            story.append(Spacer(5, 10))

            rgb_info = f"Captured RGB Values: R={capture['rgb_values']['R']}, G={capture['rgb_values']['G']}, B={capture['rgb_values']['B']}"
            story.append(Paragraph(rgb_info, info_style))
            story.append(Spacer(5, 10))

            # Add captured image
            image_url = capture['image_url']
            relative_path = image_url.replace('/files/', '')
            image_path = os.path.join(history_directory, relative_path)
            if os.path.exists(image_path):
                img = Image(image_path)
                img.drawHeight = 40 * mm
                img.drawWidth = 60 * mm
                story.append(img)
                story.append(Spacer(5, 12))

            # Add histogram image
            histogram_url = capture['histogram_url']
            relative_path = histogram_url.replace('/files/', '')
            histogram_path = os.path.join(history_directory, relative_path)
            if os.path.exists(histogram_path):
                hist_img = Image(histogram_path)
                hist_img.drawHeight = 40 * mm
                hist_img.drawWidth = 60 * mm
                story.append(hist_img)
                story.append(Spacer(5, 20))

        doc.build(story)
        return pdf_filepath
    
    @staticmethod
    # test function to create pdf report using dummy data
    def create_dummy_pdf(output_directory, image_url, histogram_url):
        captures_data = []
        for i in range(1, 4):
            capture_info = {
                "capture_number": i,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "image_url": image_url,
                "histogram_url": histogram_url,
                "rgb_values": {
                    "R": 100 + i * 10, 
                    "G": 150 + i * 10, 
                    "B": 200 + i * 10
                },
                "histogram_data": [0] * 256  # Dummy histogram data
            }
            captures_data.append(capture_info)
        
        pdf_filepath = PDFCreator.create_pdf(captures_data, output_directory)
        return pdf_filepath