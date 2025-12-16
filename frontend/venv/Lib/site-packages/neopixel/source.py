from abc import ABC, abstractmethod

from numpy import ndarray


class Source(ABC):
    rate: int
    fps: int

    @abstractmethod
    def audio_sample(self) -> ndarray:
        pass
