"""Interactive entry point; see blender/build_nd_details.py for batch export."""
import sys
sys.path.insert(0, r"C:/Users/Damon/car-configurator/blender")
import nd_detail_kit as kit
coll = kit.tow_hook() if globals().get('WHICH', 'FA05') == 'FA06' else kit.dive_planes()
