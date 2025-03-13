import numpy as np
from scipy.ndimage import gaussian_filter1d

from . import ExpFilter, Source, Visualizer
from .melbank import compute_melmat


class Sampler:
    y_rolling: np.ndarray
    source: Source
    _gamma_table = None

    def __init__(self, source: Source, visualizer: Visualizer, gamma_table_path: str = None, num_pixels: int = 60,
                 max_pixels_per_packet: int = 126, min_volume_threshold: int = 1e-7,
                 num_frames_rolling_window: int = 2, num_frequency_bins: int = 24,
                 min_freq: int = 200, max_freq: int = 12000
                 ):
        self.num_pixels = num_pixels
        self.source = source
        self.visualizer = visualizer
        self.pixels = np.tile(1, (3, self.num_pixels))
        self.prev_sample = np.tile(253, (3, self.num_pixels))
        self.y_rolling = np.random.rand(num_frames_rolling_window, int(source.rate / source.fps)) / 1e16
        self.fft_window = np.hamming(int(source.rate / source.fps) * num_frames_rolling_window)
        self.mel_gain = ExpFilter(np.tile(1e-1, num_frequency_bins),
                                  alpha_decay=0.01, alpha_rise=0.99)
        self.mel_smoothing = ExpFilter(np.tile(1e-1, num_frequency_bins),
                                       alpha_decay=0.5, alpha_rise=0.99)
        self.mel_y, _ = compute_melmat(num_mel_bands=num_frequency_bins,
                                       freq_min=min_freq,
                                       freq_max=max_freq,
                                       num_fft_bands=int(source.rate * num_frames_rolling_window / (2.0 * source.fps)),
                                       sample_rate=source.rate)
        self.min_vol = min_volume_threshold
        if gamma_table_path:
            self._gamma_table = np.load(gamma_table_path)
        if max_pixels_per_packet:
            self.max_pixels_per_packet = max_pixels_per_packet

    def sample(self) -> bytes:
        # Truncate values and cast to integer
        p = np.clip(self.pixels, 0, 255).astype(int)
        if self._gamma_table:
            p = self._gamma_table[p]
        idxs = [i for i in range(p.shape[1]) if not np.array_equal(p[:, i], self.prev_sample[:, i])]
        n_packets = len(idxs) // self.max_pixels_per_packet + 1
        idxs = np.array_split(idxs, n_packets)
        m = []
        for idx in idxs:
            for i in idx:
                m.append(i)  # Index of pixel to change
                m.append(p[0][i])  # Pixel red value
                m.append(p[1][i])  # Pixel green value
                m.append(p[2][i])  # Pixel blue value
        self.prev_sample = np.copy(p)
        return bytes(m)

    def update_sample(self) -> np.ndarray:
        y = self.source.audio_sample() / 2.0 ** 15
        self.y_rolling[:-1] = self.y_rolling[1:]
        self.y_rolling[-1, :] = np.copy(y)
        y_data = np.concatenate(self.y_rolling, axis=0).astype(np.float32)

        vol = np.max(np.abs(y_data))
        if vol < self.min_vol:
            self.pixels = np.tile(0, (3, self.num_pixels))
        else:
            rolling_len = len(y_data)
            n_zeros = 2 ** int(np.ceil(np.log2(rolling_len))) - rolling_len
            # Pad with zeros until the next power of two
            y_data *= self.fft_window
            y_padded = np.pad(y_data, (0, n_zeros), mode='constant')
            # Construct a Mel filterbank from the FFT data
            mel = np.atleast_2d(
                np.abs(np.fft.rfft(y_padded)[:rolling_len // 2])
            ).T * self.mel_y.T
            # Scale data to values more suitable for visualization
            mel = np.sum(mel, axis=0)
            mel = mel ** 2.0
            # Gain normalization
            self.mel_gain.update(np.max(gaussian_filter1d(mel, sigma=1.0)))
            mel /= self.mel_gain.value
            mel = self.mel_smoothing.update(mel)
            # Map filterbank output onto LED strip
            self.pixels = self.visualizer.visualize(mel)
            return self.pixels
