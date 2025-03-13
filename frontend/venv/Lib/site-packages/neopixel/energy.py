import numpy as np
from scipy.ndimage import gaussian_filter1d

from . import ExpFilter, Visualizer


class Energy(Visualizer):
    def __init__(self, num_pixels: int, num_frequency_bins: int = 24):
        self.num_pixels = num_pixels
        self.pixels = np.tile(1.0, (3, self.num_pixels // 2))
        self.gain = ExpFilter(np.tile(0.01, num_frequency_bins), alpha_decay=0.001, alpha_rise=0.99)
        self.pixel_filter = ExpFilter(np.tile(1, (3, self.num_pixels // 2)),
                                      alpha_decay=0.1, alpha_rise=0.99)

    def visualize(self, inp: np.ndarray) -> np.ndarray:
        y = np.copy(inp)
        self.gain.update(y)
        y /= self.gain.value
        # Scale by the width of the LED strip
        y *= float((self.num_pixels // 2) - 1)
        # Map color channels according to energy in the different freq bands
        scale = 0.9
        r = int(np.mean(y[:len(y) // 3] ** scale))
        g = int(np.mean(y[len(y) // 3: 2 * len(y) // 3] ** scale))
        b = int(np.mean(y[2 * len(y) // 3:] ** scale))
        # Assign color to different frequency regions
        self.pixels[0, :r] = 255.0
        self.pixels[0, r:] = 0.0
        self.pixels[1, :g] = 255.0
        self.pixels[1, g:] = 0.0
        self.pixels[2, :b] = 255.0
        self.pixels[2, b:] = 0.0
        self.pixel_filter.update(self.pixels)
        self.pixels = np.round(self.pixel_filter.value)
        # Apply substantial blur to smooth the edges
        self.pixels[0, :] = gaussian_filter1d(self.pixels[0, :], sigma=4.0)
        self.pixels[1, :] = gaussian_filter1d(self.pixels[1, :], sigma=4.0)
        self.pixels[2, :] = gaussian_filter1d(self.pixels[2, :], sigma=4.0)
        # Set the new pixel value
        return np.concatenate((self.pixels[:, ::-1], self.pixels), axis=1)
