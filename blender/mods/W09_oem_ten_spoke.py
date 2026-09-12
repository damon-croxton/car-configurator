"""Interactive entry point; see blender/build_nd_details.py for batch export."""
import sys
sys.path.insert(0, r"C:/Users/Damon/car-configurator/blender")
import nd_wheel_refinement as wheels
coll = wheels.build('W09')
