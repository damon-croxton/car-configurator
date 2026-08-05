"""
Conform a third-party MX-5 model to the configurator's scene-graph contract.

    blender --background --python scripts/blender/conform_mx5.py -- \
            --input raw/mx5_source.glb \
            --output public/assets/models/mx5_nd.glb

Runs headless, so it works in CI and in a container with no GUI. The mapping
from source object names to contract names lives in a small JSON sidecar next
to the source file, because *that* part is a human judgement — deciding where
the body ends and the bumper begins is what interactive Blender (or
`blender-mcp`) is for. This script's job is to make the decision reproducible.

    raw/mx5_source.map.json
    {
      "Body_Main":        ["body", "bonnet", "boot_lid", "front_bumper"],
      "Glass_Windshield": ["windscreen"],
      "Wheel_FL":         ["wheel_front_left"],
      "_discard":         ["studio_backdrop", "camera_rig"]
    }

Anything unmapped is left where it is and simply never adopted by the app,
which keeps the procedural counterpart. Validate the result with:

    node scripts/validate-asset.mjs public/assets/models/mx5_nd.glb
"""

import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector

# ND reference dimensions in metres. Must match carData.json → generations[nd].
TARGET_LENGTH = 3.915
TARGET_WHEELBASE = 2.31

WHEEL_NODES = ["Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR"]


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Conform a car model to the node contract.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--map", help="Defaults to <input>.map.json")
    parser.add_argument(
        "--forward-axis",
        default="+Z",
        choices=["+Z", "-Z", "+X", "-X"],
        help="Which axis the source model points along. Ours is +Z.",
    )
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0


def import_source(path: str) -> None:
    extension = os.path.splitext(path)[1].lower()
    if extension in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif extension == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif extension == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    elif extension == ".blend":
        bpy.ops.wm.open_mainfile(filepath=path)
    else:
        raise SystemExit(f"Unsupported input format: {extension}")


def mesh_objects() -> list:
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def world_bounds(objects) -> tuple[Vector, Vector]:
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    for obj in objects:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                lo[axis] = min(lo[axis], point[axis])
                hi[axis] = max(hi[axis], point[axis])
    return lo, hi


def select_only(objects) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    if objects:
        bpy.context.view_layer.objects.active = objects[0]


def apply_transforms(objects) -> None:
    select_only(objects)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def orient(objects, forward_axis: str) -> None:
    """Rotate so the nose points +Z and Y is up — glTF's own convention."""
    rotations = {"+Z": 0.0, "-Z": math.pi, "+X": -math.pi / 2, "-X": math.pi / 2}
    angle = rotations[forward_axis]
    if angle == 0.0:
        return
    select_only(objects)
    bpy.ops.transform.rotate(value=angle, orient_axis="Y", orient_type="GLOBAL")
    apply_transforms(objects)


def scale_and_ground(objects) -> float:
    """Scale to the real car's length and drop it so the tyres touch y = 0."""
    lo, hi = world_bounds(objects)
    length = hi.z - lo.z
    if length <= 0:
        raise SystemExit("Source model has zero length along Z — check --forward-axis.")

    factor = TARGET_LENGTH / length
    select_only(objects)
    bpy.ops.transform.resize(value=(factor, factor, factor))
    apply_transforms(objects)

    lo, hi = world_bounds(objects)
    centre_x = (lo.x + hi.x) / 2
    centre_z = (lo.z + hi.z) / 2
    select_only(objects)
    # Centre laterally and longitudinally, and sit the lowest point on the floor.
    bpy.ops.transform.translate(value=(-centre_x, -lo.y, -centre_z))
    apply_transforms(objects)
    return factor


def rename_from_map(mapping: dict) -> dict:
    """Join each group of source objects into one object with the contract name."""
    by_source = {}
    for target, sources in mapping.items():
        for source in sources:
            by_source[source.lower()] = target

    groups: dict[str, list] = {}
    for obj in mesh_objects():
        target = by_source.get(obj.name.lower())
        if target:
            groups.setdefault(target, []).append(obj)

    for target, members in groups.items():
        if target == "_discard":
            for obj in members:
                bpy.data.objects.remove(obj, do_unlink=True)
            continue

        if len(members) > 1:
            select_only(members)
            bpy.ops.object.join()
            joined = bpy.context.view_layer.objects.active
        else:
            joined = members[0]
        joined.name = target

    return {t: len(m) for t, m in groups.items() if t != "_discard"}


def recentre_wheel_pivots() -> None:
    """
    Put each wheel's origin at its own centre so the app can spin it about local
    X and apply camber without the car swinging around the world origin.
    """
    for name in WHEEL_NODES:
        obj = bpy.data.objects.get(name)
        if not obj:
            continue
        select_only([obj])
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")


def build_hierarchy() -> None:
    """
    Parent everything except the wheels under `Suspension_Node`, which is the
    node the app translates for ride height. Wheels stay at the root so lowering
    the body never lifts the contact patches.
    """
    root = bpy.data.objects.new("MX5_Root", None)
    suspension = bpy.data.objects.new("Suspension_Node", None)
    bpy.context.scene.collection.objects.link(root)
    bpy.context.scene.collection.objects.link(suspension)
    suspension.parent = root

    for obj in mesh_objects():
        if obj.parent is not None:
            continue
        obj.parent = suspension if obj.name not in WHEEL_NODES else root
        obj.matrix_parent_inverse.identity()


def export(path: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        use_selection=False,
    )


def main() -> None:
    args = parse_args()
    map_path = args.map or f"{os.path.splitext(args.input)[0]}.map.json"

    mapping = {}
    if os.path.exists(map_path):
        with open(map_path, encoding="utf-8") as handle:
            mapping = json.load(handle)
        print(f"Using name map {map_path} ({len(mapping)} target(s))")
    else:
        print(f"No name map at {map_path} — importing without renaming.")
        print("The result will satisfy no contract nodes; write a map to fix that.")

    reset_scene()
    import_source(args.input)

    objects = mesh_objects()
    if not objects:
        raise SystemExit("No mesh objects found in the source file.")
    print(f"Imported {len(objects)} mesh object(s)")

    apply_transforms(objects)
    orient(objects, args.forward_axis)
    factor = scale_and_ground(mesh_objects())
    print(f"Scaled by {factor:.4f} to a {TARGET_LENGTH} m length "
          f"(reference wheelbase {TARGET_WHEELBASE} m)")

    if mapping:
        joined = rename_from_map(mapping)
        for target, count in sorted(joined.items()):
            print(f"  {target} ← {count} source object(s)")

    recentre_wheel_pivots()
    build_hierarchy()
    export(args.output)

    lo, hi = world_bounds(mesh_objects())
    print(f"\nWrote {args.output}")
    print(f"  bounds  X {hi.x - lo.x:.3f}  Y {hi.y - lo.y:.3f}  Z {hi.z - lo.z:.3f}")
    print(f"  ground  Y {lo.y:.3f}")
    print("\nNow run: node scripts/validate-asset.mjs " + args.output)


if __name__ == "__main__":
    main()
