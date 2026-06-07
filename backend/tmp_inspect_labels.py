import pickle
import io
from numpy.lib import format

path = 'data/label_classes.npy'
with open(path, 'rb') as f:
    format.read_magic(f)
    format.read_array_header_1_0(f)
    data = f.read()

import sys
import numpy as np
import importlib
sys.modules['numpy._core'] = np.core
sys.modules['numpy._core.multiarray'] = importlib.import_module('numpy.core.multiarray')

class FixUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module == 'numpy._core':
            module = 'numpy.core'
        return pickle.Unpickler.find_class(self, module, name)

obj = FixUnpickler(io.BytesIO(data)).load()
print(type(obj))
print(obj)
