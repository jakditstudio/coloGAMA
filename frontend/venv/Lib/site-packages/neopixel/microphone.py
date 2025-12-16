import pyaudio
from numpy import ndarray, frombuffer, float32, int16

from .source import Source


class Microphone(Source):
    py_audio: pyaudio.PyAudio
    stream: pyaudio.Stream
    rate: int
    fps: int
    overflows: int = 0

    def __init__(self, rate: int = 44100, fps: int = 60):
        self.rate = rate
        self.fps = fps

    def __enter__(self):
        self.py_audio = pyaudio.PyAudio()
        self.stream = self.py_audio.open(format=pyaudio.paInt16,
                                         channels=1,
                                         rate=self.rate,
                                         input=True,
                                         frames_per_buffer=int(self.rate / self.fps))
        self.stream.start_stream()
        return self

    def audio_sample(self) -> ndarray:
        if not self.stream:
            return ndarray([])
        try:
            y = frombuffer(self.stream.read(int(self.rate / self.fps)), dtype=int16)
            y = y.astype(float32)
            # empty remaining buffer
            self.stream.read(self.stream.get_read_available())
            return y
        except IOError:
            self.overflows += 1
            print('Audio buffer has overflowed {} times'.format(self.overflows))
            return ndarray([])

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stream.stop_stream()
        self.stream.close()
        self.py_audio.terminate()
