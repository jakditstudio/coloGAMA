import board
import neopixel
import io
import logging
import socketserver
from http import server
from threading import Condition

from libcamera import controls
from libcamera import Transform
from picamera2 import Picamera2
from picamera2.encoders import JpegEncoder
from picamera2.outputs import FileOutput

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
        self.picam2 = None  
        
    def start_feed(self, output):
        self.stop_feed()  # Ensure any existing feed is stopped before starting a new one
        self.pixels1.fill(self.PREVIEW_LED_COLOR)  # Set initial color

        self.picam2 = Picamera2()
        self.camera_config = self.picam2.create_video_configuration(main={"size": (640, 480)}, transform=Transform(vflip=1))
        self.picam2.configure(self.camera_config)
        self.picam2.set_controls({"AfMode": controls.AfModeEnum.Manual, "LensPosition": 11.})
        self.picam2.start_recording(JpegEncoder(), FileOutput(output))
        

    def stop_feed(self):
        try:
            self.picam2.stop_recording()
        except Exception as e:
            pass
        try:
            self.pixels1.fill((0, 0, 0))  # Turn off the Neopixel LED
        except Exception as e:
            pass

    def generate_frames(self, output):
        try:
            while True:
                with output.condition:
                    output.condition.wait()
                    frame = output.frame
                    yield (b'--FRAME\r\n'
                           b'Content-Type: image/jpeg\r\n'
                           b'Content-Length: ' + str(len(frame)).encode() + b'\r\n\r\n'
                           + frame + b'\r\n')
        except Exception as e:
            logging.warning('Removed streaming client: %s', str(e)) 
        finally:
            self.stop_feed()  # Ensure the feed is stopped when the generator is done       