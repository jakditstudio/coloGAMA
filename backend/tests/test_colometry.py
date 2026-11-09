import unittest
from unittest.mock import patch, MagicMock
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # Add parent directory to sys.path
sys.modules['neopixel'] = MagicMock()
sys.modules['board'] = MagicMock()
sys.modules['picamera2'] = MagicMock()
sys.modules['libcamera'] = MagicMock()
from colometry import process_colometry
from create_pdf import PDFCreator
import numpy as np
import cv2


class TestColometry(unittest.TestCase):
    @patch('cv2.imread')
    @patch('cv2.calcHist')
    @patch('colometry.Picamera2')
    def test_full_process_flow(self, mock_picamera2, mock_calcHist, mock_imread):
        dummy_img = np.zeros((480,640,3), dtype=np.uint8)
        mock_imread.return_value = dummy_img
        mock_calcHist.return_value = np.zeros((256,1), dtype=np.float32)

        with patch('time.sleep', return_value=None):
            result = process_colometry()
        self.assertIn("pdf_filepath", result)
        self.assertTrue("captures", result)

        self.assertTrue(os.path.exists(result["pdf_filepath"]))
        self.assertEqual(len(result["captures"]), 5)

        self.assertEqual(mock_imread.call_count, 5)
        self.assertEqual(mock_picamera2.return_value.capture_file.call_count, 5)

    def test_pdf_generation(self):
        history_dir = "history"
        img_dir = os.path.join(history_dir, "captures_image")
        hist_dir = os.path.join(history_dir, "histogram")
        os.makedirs(img_dir, exist_ok=True)
        os.makedirs(hist_dir, exist_ok=True)

        # create dummy image and histogram files
        dummy_img = np.zeros((480,640,3), dtype=np.uint8)
        dummy_hist = np.zeros((256,1), dtype=np.float32)
        cv2.imwrite(os.path.join(img_dir, "test.jpg"), dummy_img)
        cv2.imwrite(os.path.join(hist_dir, "test_hist.jpg"), dummy_hist)

        dummy_data = []

        for i in range(1, 6):
            capture_info={
                "capture_number": i,
                "timestamp": "20240601_123456",
                "image_url": "/files/captures_image/test.jpg",
                "histogram_url": "/files/histogram/test_hist.jpg",
                "rgb_values": {
                    "R": 120,
                    "G": 130,
                    "B": 140
                },
            }
            dummy_data.append(capture_info)

        # get this test file's directory
        test_dir = os.path.dirname(os.path.relpath(__file__))
        os.makedirs(os.path.join(test_dir, 'pdf_sample'), exist_ok=True)
        pdf_path = PDFCreator.create_pdf(dummy_data, os.path.join(test_dir, 'pdf_sample'))
        self.assertTrue(os.path.exists(pdf_path))
        # os.remove(pdf_path)