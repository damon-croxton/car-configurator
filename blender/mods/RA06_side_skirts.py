"""Build the revised ND accessory against a raw ND reference import.

Use blender/build_nd_street.py for an isolated complete build and GLB export.
This wrapper keeps the existing interactive Blender entry point available.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(r"C:/Users/Damon/car-configurator/blender")))
import importlib
import nd_street_kit as kit
importlib.reload(kit)
coll = kit.build_skirts(globals().get('WHICH', 'RA06'))
kit.m.stats(coll)
