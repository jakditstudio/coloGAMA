import board
import neopixel
import io
import logging
import socketserver
from http import server
from threading import Condition
import threading
import time

from libcamera import controls
from libcamera import Transform
from picamera2 import Picamera2
from picamera2.encoders import JpegEncoder
from picamera2.outputs import FileOutput


def open_camera(retries=3, delay=0.2):
    """Opens the camera and returns a Picamera2 instance."""
    for _ in range(retries):
        try:
            picam2 = Picamera2()
            logging.info("Camera opened.")
            return picam2
        except Exception as e:
            logging.warning(f"Failed to open camera: {e}")
            time.sleep(delay)
    raise RuntimeError("Failed to open camera after multiple attempts.")

class StreamingOutput(io.BufferedIOBase):
    def __init__(self):
        self.frame = None
        self.condition = Condition()

    def write(self, buf):
        with self.condition:
            self.frame = buf
            self.condition.notify_all()

class liveFeedParams:
    def __init__(self):
        # Initialize Neopixel LED params during preview
        self.PREVIEW_LED_COLOR = (255, 255, 200)  # Set initial color for preview
        self.PREVIEW_BRIGHTNESS = 0.5  # Set brightness for preview
        self.pixels1 = neopixel.NeoPixel(board.D18, 7, brightness=self.PREVIEW_BRIGHTNESS)
        self.current_stop_event = None
        # self.picam2 = None  
        
    def start_feed(self, output):
        if self.current_stop_event:
            self.current_stop_event.set()  # Signal the previous feed to stop
        stop_event = threading.Event()
        self.current_stop_event = stop_event  # Store the current stop event

        # self.stop_feed()  
        picam2 = open_camera()
        self.pixels1.fill(self.PREVIEW_LED_COLOR)  # Set initial color
        logging.info("Starting live feed...")
        logging.warning(f"[start feed] Picamera2 id: {id(picam2)} thread={threading.current_thread().name}")
        self.camera_config = picam2.create_video_configuration(main={"size": (640, 480)}, transform=Transform(vflip=1))
        picam2.configure(self.camera_config)
        picam2.set_controls({"AfMode": controls.AfModeEnum.Manual, "LensPosition": 11.})
        picam2.start_recording(JpegEncoder(), FileOutput(output))
        return picam2, stop_event
        

    def stop_feed(self, picam2):
        logging.info("Stopping live feed...")
        logging.warning(f"[stop feed] Picamera2 id: {id(picam2)} thread={threading.current_thread().name}")
        try:
            picam2.stop_recording()
        except Exception as e:
            pass
        try:
            picam2.close()
        except Exception as e:
            pass
        try:
            self.pixels1.fill((0, 0, 0))  # Turn off the Neopixel LED
        except Exception as e:
            pass

    def generate_frames(self, picam2, output, stop_event):
        logging.info("Generating frames for streaming...")
        logging.warning(f"[generate frames] started thread={threading.current_thread().name}")
        try:
            while not stop_event.is_set():
                with output.condition:
                    got_frame = output.condition.wait(timeout=1.0)  # Wait for a new frame or timeout
                    if not got_frame:
                        logging.warning("Timeout waiting for new frame.")
                        continue
                    frame = output.frame
                yield (b'--FRAME\r\n'
                       b'Content-Type: image/jpeg\r\n'
                       b'Content-Length: ' + str(len(frame)).encode() + b'\r\n\r\n'
                       + frame + b'\r\n')
        except Exception as e:
            logging.warning('Removed streaming client: %s', str(e)) 
        finally:
            logging.info("Stopping live feed thread=%s...", threading.current_thread().name)
            self.stop_feed(picam2)  # Ensure the feed is stopped when the generator is done       