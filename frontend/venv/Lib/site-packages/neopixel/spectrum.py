import numpy as np

from .dsp import ExpFilter

from .visualizer import Visualizer


class Spectrum(Visualizer):

    def __init__(self, num_pixels: int, **kwargs):
        self.num_pixels = num_pixels
        self.prev_spectrum = np.tile(0.01, self.num_pixels // 2)
        self.common_mode = ExpFilter(np.tile(0.01, self.num_pixels // 2),
                                     alpha_decay=0.99, alpha_rise=0.01)
        self.red_filter = ExpFilter(np.tile(0.01, self.num_pixels // 2),
                                    alpha_decay=0.2, alpha_rise=0.99)
        self.blue_filter = ExpFilter(np.tile(0.01, self.num_pixels // 2),
                                     alpha_decay=0.1, alpha_rise=0.5)

    def visualize(self, inp: np.ndarray) -> np.ndarray:
        y = np.copy(self._interpolate(inp, self.num_pixels // 2))
        self.common_mode.update(y)
        diff = y - self.prev_spectrum
        self.prev_spectrum = np.copy(y)
        # Color channel mappings
        r = self.red_filter.update(y - self.common_mode.value)
        g = np.abs(diff)
        b = self.blue_filter.update(np.copy(y))
        # Mirror the color channels for symmetric output
        return np.array([
            np.concatenate((r[::-1], r)),
            np.concatenate((g[::-1], g)),
            np.concatenate((b[::-1], b)),
        ]) * 255

    @staticmethod
    def _interpolate(y, new_length):
        if len(y) == new_length:
            return y
        return np.interp(
            np.linspace(0, 1, new_length),  # x_new
            np.linspace(0, 1, len(y)),  # x_old
            y,
        )
