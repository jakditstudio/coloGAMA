from abc import ABC, abstractmethod
from numpy import ndarray


class Visualizer(ABC):
    @abstractmethod
    def visualize(self, inp: ndarray) -> ndarray:
        pass
