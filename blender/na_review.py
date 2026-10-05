"""Workbench review renders of the NA or ND reference and its mods.

exec'd inside a Blender session that already has the NA imported:
    exec(open(r"C:/Users/Damon/car-configurator/blender/na_review.py").read())
    review("before", views=["front", "rear"])
"""
import bpy
import mx5_lib as m

OUT = m.REPO + "/blender/build"

VIEWS = {
    # label: (camera app-mm, target app-mm, ortho scale m)
    "front":        ((3600, 1500, 6200), (0, 450, 900), 5.0),
    "front_low":    ((2000, 450, 4600), (0, 260, 1800), 2.6),
    "side":         ((5200, 700, 0), (0, 420, 0), 4.6),
    "sill":         ((4200, 500, 1200), (0, 240, 0), 2.8),
    "rear":         ((-3000, 1900, -5200), (0, 650, -900), 4.6),
    "rear_low":     ((-1500, 600, -4600), (-150, 380, -1800), 2.4),
    "rear_deck":    ((-1600, 2200, -3900), (0, 800, -1500), 2.2),
    "cabin":        ((2600, 2800, -2800), (0, 900, -200), 3.0),
    "top":          ((0, 6500, 0), (0, 500, 0), 5.0),
    "rear34":       ((-3200, 1700, -4600), (0, 700, -1100), 3.4),
    "spoiler":      ((-900, 1400, -3600), (0, 800, -1820), 1.4),
    "bar_rear":     ((-1800, 1600, -3600), (0, 950, -900), 2.0),
}


def only(*idents, gen="na"):
    """Show just these mods (by id) for one car in renders."""
    prefix = f"MOD_{gen.upper()}_"
    for coll in bpy.data.collections:
        if coll.name.startswith("MOD_"):
            show = coll.name.startswith(prefix) and coll.name[len(prefix):] in idents
            for obj in coll.objects:
                obj.hide_render = not show


def review(tag, views=None, size=(1200, 900), gen="na", color_type="MATERIAL"):
    """Render views of one car. When both references share the scene (in
    NA_REF / ND_REF collections), the other car is hidden from the render."""
    scene = bpy.context.scene
    # NB/NC import into <GEN>_SRC (prepare_nb_nc), the others into <GEN>_REF.
    for name in ("NA_REF", "ND_REF", "NB_SRC", "NC_SRC"):
        coll = bpy.data.collections.get(name)
        if coll is not None:
            coll.hide_render = name[:2] != gen.upper()
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = color_type     # "TEXTURE" shows embedded images (weaves)
    shading.show_shadows = False
    shading.show_cavity = True
    shading.cavity_type = "BOTH"
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    cam_data = bpy.data.cameras.get("NAReviewCamera") or bpy.data.cameras.new("NAReviewCamera")
    cam = bpy.data.objects.get("NAReviewCamera") or bpy.data.objects.new("NAReviewCamera", cam_data)
    if cam.name not in scene.collection.objects:
        scene.collection.objects.link(cam)
    scene.camera = cam
    cam_data.type = "ORTHO"
    cam_data.clip_end = 100
    paths = []
    for label in views or VIEWS:
        pos, target, scale = VIEWS[label]
        cam.location = m.app_to_blender(*pos, gen=gen)
        cam.rotation_euler = (m.app_to_blender(*target, gen=gen) - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam_data.ortho_scale = scale
        scene.render.filepath = f"{OUT}/{gen}_{tag}_{label}.png"
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    return paths
