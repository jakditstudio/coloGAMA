import numpy as np
from scipy.ndimage import gaussian_filter1d

from .dsp import ExpFilter
from .visualizer import Visualizer


class Scroll(Visualizer):
    def __init__(self, num_pixels: int, num_frequency_bins: int = 24):
        self.num_pixels = num_pixels
        self.pixels = np.tile(1.0, (3, num_pixels // 2))
        self.gain = ExpFilter(np.tile(0.01, num_frequency_bins), alpha_decay=0.001, alpha_rise=0.99)

    def visualize(self, inp: np.ndarray) -> np.ndarray:
        y = inp ** 2.0
        self.gain.update(y)
        y /= self.gain.value
        y *= 255.0
        r = int(np.max(y[:len(y) // 3]))
        g = int(np.max(y[len(y) // 3: 2 * len(y) // 3]))
        b = int(np.max(y[2 * len(y) // 3:]))
        # Scrolling effect window
        self.pixels[:, 1:] = self.pixels[:, :-1]
        self.pixels *= 0.98
        self.pixels = gaussian_filter1d(self.pixels, sigma=0.2)
        # Create new color originating at the center
        self.pixels[0, 0] = r
        self.pixels[1, 0] = g
        self.pixels[2, 0] = b
        # Update the LED strip
        return np.concatenate((self.pixels[:, ::-1], self.pixels), axis=1)
