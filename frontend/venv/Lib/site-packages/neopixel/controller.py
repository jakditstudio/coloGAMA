import socket
from time import time

from typing import Callable

from .dsp import ExpFilter
from .sampler import Sampler


class Controller:
    sampler: Sampler = None
    prev_time: float = time() * 1000.0

    def __init__(self, sampler: Sampler, on_sample: Callable = None, address: str = "127.0.0.1", port: int = 7777,
                 show_fps: bool = False):
        self.sampler = sampler
        self.on_sample = on_sample
        self.show_fps = show_fps
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._addr = address
        self._port = port
        self._fps = ExpFilter(val=sampler.source.fps, alpha_decay=0.2, alpha_rise=0.2)
        self._is_running = False

    def process_sample(self):
        self.send_data()
        self.on_sample(self.sampler.update_sample()) if self.on_sample else self.sampler.update_sample()

    def run(self):
        if self._is_running:
            return
        self._is_running = True
        while self._is_running:
            self.process_sample()

    def stop(self, *args):
        self._is_running = False

    def send_data(self):
        self._sock.sendto(self.sampler.sample(), (self._addr, self._port))

    def fps(self):
        time_now = time() * 1000.0
        dt = time_now - self.prev_time
        self.prev_time = time_now
        if dt == 0.0:
            return self._fps.value
        return self._fps.update(1000.0 / dt)
