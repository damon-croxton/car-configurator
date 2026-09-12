"""Independent, surface-fitted ND street accessories.

Run with build_nd_street.py. All design dimensions below are millimetres in
the app frame. The original car is only ray-cast: no vertices are copied,
displaced, hidden or exported from it. Small mounting clearances are explicit.
"""
import math
import bpy
import bmesh
from mathutils import Vector
import mx5_lib as m

GEN = 'nd'
GAP = 0.7


def app(v):
    scale, (ox, oy, oz) = m._frame(GEN)
    return Vector((-v.x * scale * 1000, v.z * scale * 1000 + oy,
                   v.y * scale * 1000 + oz))


def ray(obj, origin, direction):
    inv = obj.matrix_world.inverted()
    start = m.app_to_blender(*origin)
    end = m.app_to_blender(*(Vector(origin) + Vector(direction)))
    hit, location, normal, _ = obj.ray_cast(inv @ start,
        (inv.to_3x3() @ (end - start)).normalized())
    return app(obj.matrix_world @ location) if hit else None


def height(obj, x, z):
    hit = ray(obj, (x, 2000, z), (0, -1, 0))
    if hit is None:
        raise ValueError(f'No mounting surface on {obj.name} at x={x}, z={z}')
    return hit.y


def smooth(t):
    t = max(0, min(1, t))
    return t * t * (3 - 2 * t)


def mesh_object(name, rings, coll, material):
    """Closed quad loft with explicit UVs and consistently outward normals."""
    n = len(rings[0])
    verts = [m.app_to_blender(*p) for ring in rings for p in ring]
    faces = []
    for i in range(len(rings) - 1):
        for j in range(n):
            k = (j + 1) % n
            faces.append((i*n+j, i*n+k, (i+1)*n+k, (i+1)*n+j))
    faces.append(tuple(reversed(range(n))))
    faces.append(tuple((len(rings)-1)*n+j for j in range(n)))
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    coll.objects.link(obj)
    m.assign(obj, material)
    shader = obj.data.materials[0]
    shader.use_backface_culling = True
    if material == 'MOD_SatinBlack':
        bsdf = shader.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (0.004,0.005,0.006,1)
        bsdf.inputs['Metallic'].default_value = 0
        bsdf.inputs['Roughness'].default_value = 0.62
        bsdf.inputs['Specular IOR Level'].default_value = 0.18
        shader.diffuse_color = (0.018,0.022,0.027,1)
    elif material == 'MOD_BodyPaint':
        shader.diffuse_color = (0.5,0.012,0.018,1)
    else:
        shader.diffuse_color = (0.025,0.027,0.03,1)
    if material == 'MOD_CarbonWeave':
        carbon_material(obj.data.materials[0])
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    for face in data.polygons:
        face.use_smooth = len(face.vertices) == 4
    # Longitudinal UV strips; separate each cross-section face into its own
    # island. No box-projection overlap on the closed accessory underside.
    uv = data.uv_layers.new(name='UVMap')
    distances = [0.0]
    for a, b in zip(rings, rings[1:]):
        distances.append(distances[-1] + (Vector(b[0])-Vector(a[0])).length)
    for face in data.polygons:
        if face.index < (len(rings)-1)*n:
            i, j = divmod(face.index, n)
            u0, u1 = distances[i]/50, distances[i+1]/50
            strip = j * 4.0
            v1 = strip + (Vector(rings[i][(j+1)%n])-Vector(rings[i][j])).length/50
            for loop, co in zip(face.loop_indices, [(u0,strip),(u0,v1),(u1,v1),(u1,strip)]):
                uv.data[loop].uv = co
        else:
            for loop in face.loop_indices:
                p = data.vertices[data.loops[loop].vertex_index].co
                uv.data[loop].uv = (p.x*20, p.y*20 + n*4 + face.index)
    return obj


def carbon_material(material):
    """Embed a restrained 2-over/2-under weave; no live procedural nodes."""
    import numpy as np
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (1,1,1,1)
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.55
    bsdf.inputs['Specular IOR Level'].default_value = 0.10
    bsdf.inputs['Coat Weight'].default_value = 0.10
    bsdf.inputs['Coat Roughness'].default_value = 0.45
    size=256
    yy,xx=np.mgrid[0:size,0:size].astype(float)
    cell=16
    vertical=((xx//cell+yy//cell)%4)<2
    cross=np.where(vertical,xx%cell,yy%cell)/cell
    longitudinal=np.where(vertical,yy,xx)
    crown=np.sin(np.pi*cross)**0.65
    strand=0.5+0.5*np.cos(cross*np.pi*16)
    # The exported PNG reads 20..38/255: charcoal yarn with a subtle weave.
    # Keep resin reflections restrained under the bright studio light cards.
    level=0.085+0.05*crown+0.008*strand+0.006*np.cos(longitudinal*np.pi/32)
    relief=crown*0.012
    gy,gx=np.gradient(relief)
    for label,rgba in [
        ('ND_Street_Carbon_Base',np.dstack([level*0.95,level*0.98,level,np.ones_like(level)])),
        ('ND_Street_Carbon_Normal',np.dstack([0.5-gx*3,0.5-gy*3,np.ones_like(level),np.ones_like(level)])),
    ]:
        image=bpy.data.images.get(label)
        if image is None:
            image=bpy.data.images.new(label,width=size,height=size)
            image.colorspace_settings.name='Non-Color' if label.endswith('Normal') else 'sRGB'
            image.pixels.foreach_set(rgba.astype('float32').ravel())
            image.pack()
        tex=nodes.get(label) or nodes.new('ShaderNodeTexImage')
        tex.name=label
        tex.image=image
        if label.endswith('Normal'):
            normal=nodes.get('StreetNormal') or nodes.new('ShaderNodeNormalMap')
            normal.name='StreetNormal'
            normal.inputs['Strength'].default_value=0.35
            links.new(tex.outputs['Color'],normal.inputs['Color'])
            links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
        else:
            links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])


def finish(coll):
    m.finalise_names(coll)
    for obj in coll.objects:
        if obj.type != 'MESH':
            continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bad = [e for e in bm.edges if not e.is_manifold]
        loose = [v for v in bm.verts if not v.link_faces]
        volume = bm.calc_volume(signed=True)
        bm.free()
        assert not bad and not loose and volume > 0, (obj.name, len(bad), len(loose), volume)
    return coll


def build_skirts(mod_id='RA06'):
    """Two low sill extensions, ~30 mm section; retain the painted sill."""
    coll = m.start_mod(GEN, mod_id)
    sill = m.base_mesh('Skirts 6.003_57')
    bounds = m.anchor('Skirts 6.003_57')['bbox']
    z0, z1 = bounds['min'][2] + 36, bounds['max'][2] - 10
    material = 'MOD_CarbonWeave' if mod_id == 'RA06B' else 'MOD_SatinBlack'
    for side in [-1, 1]:
        rings = []
        for i in range(101):
            t = i / 100
            z = z0 + (z1-z0)*t
            # Find the actual sill bottom at this station, then refine it.
            bottom = None
            for y in range(145, 205):
                if ray(sill, (side*1200, y, z), (-side,0,0)) is not None:
                    bottom = y
                    break
            assert bottom is not None, z
            def sx(y):
                p = ray(sill, (side*1200, y, z), (-side,0,0))
                assert p is not None, (y,z)
                return abs(p.x)
            end = smooth(min(t,1-t)/0.08)
            reach = 9 + 23*end
            drop = 4 + 9*end
            top = bottom + 14
            xt = sx(top)
            xb = sx(bottom + 1)
            # Cross-section: fitted flange, rounded projecting blade, closed
            # under-return, then fitted inner wall. Ends taper in plan and drop.
            section = [
                (xt+GAP,top), (xt+GAP+2,top+0.4),
                (xt+reach-3,bottom+7), (xt+reach,bottom+4),
                (xt+reach,bottom-drop+3), (xt+reach-2,bottom-drop),
                (xb+2,bottom-drop), (xb+GAP,bottom-drop+2),
                (xb+GAP,bottom+1),
                (sx(bottom+7)+GAP,bottom+7),
            ]
            rings.append([(side*x,y,z) for x,y in section])
        mesh_object(f'MOD_ND_{mod_id}_blade_{"L" if side>0 else "R"}', rings, coll, material)
    return finish(coll)


def front_hit(parts, x, y):
    hits = [ray(p, (x,y,2400), (0,0,-1)) for p in parts]
    hits = [p for p in hits if p is not None]
    return max(hits, key=lambda p:p.z) if hits else None


def build_front():
    """Full-width swept lip beneath the existing bumper, including corners."""
    coll = m.start_mod(GEN, 'FA01')
    parts = [m.base_mesh(n) for n in ['BumperF 6.003_111','BumperF 6.001_109',
                                     'BumperF 6.002_110','BumperF 6.005_113']]
    half_span = m.anchor('BumperF 6.003_111')['bbox']['max'][0] - 83
    samples = []
    for i in range(145):
        x = -half_span + 2*half_span*i/144
        bottom = next((y for y in range(155,235) if front_hit(parts,x,y) is not None),None)
        assert bottom is not None, x
        # Use the painted bumper's own outer lower seam for the mounting rail;
        # the grille trim can sit further inboard, so the broad upper blade
        # bridges from the true low edge to the visible outer face.
        top = bottom+12
        p = front_hit(parts,x,top)
        b = front_hit(parts,x,bottom+1)
        assert p is not None and b is not None, (x,top)
        samples.append((x,bottom,p.z,b.z))
    # The exterior rail is designed as one smooth blade. Ray hits only locate
    # the mounting flange: propagating every fascia/grille discontinuity into
    # the outer silhouette would make the lip lumpy at the intake corners.
    def filtered_z(index):
        weights=[]
        for j in range(max(0,index-10),min(len(samples),index+11)):
            weight=math.exp(-((j-index)/5)**2)
            weights.append((samples[j][2],weight))
        return sum(v*w for v,w in weights)/sum(w for _,w in weights)
    rail=[filtered_z(i) for i in range(len(samples))]
    rings=[]
    for i,(x,y,z,zb) in enumerate(samples):
        a,b=max(0,i-1),min(len(samples)-1,i+1)
        normal=Vector((-(rail[b]-rail[a]),0,samples[b][0]-samples[a][0])).normalized()
        end=smooth(min(i,144-i)/12)
        reach=13+19*end
        outer_y=166+10*(abs(x)/half_span)**4
        outer=Vector((x+normal.x*reach,outer_y,rail[i]+normal.z*reach))
        inner=Vector((x,y-GAP,zb+GAP))
        top=[]
        for t in [0,0.1,0.3,0.55,0.85,1]:
            p=inner.lerp(outer,t)
            # Fit the upper mounting face UNDER all lower bumper skins.
            # Casting upward also catches trim that a forward ray misses.
            hits=[ray(part,(p.x,0,p.z),(0,1,0)) for part in parts]
            levels=[hit.y-GAP for hit in hits if hit is not None]
            if levels:
                p.y=min(p.y,min(levels))
            top.append(tuple(p))
        underside=[(px,py-9,pz) for px,py,pz in reversed(top)]
        rings.append(top+underside)
    mesh_object('MOD_ND_FA01_blade',rings,coll,'MOD_SatinBlack')
    return finish(coll)


def build_spoiler(mod_id='RA01'):
    """Smooth closed moulding along the rear deck; avoid centre deck detail.

    The rear rail is inset from the rolled boot edge. Its stations were checked
    against the base mesh, not taken from the old donor's jagged face boundary.
    The lower surface and leading seam are independently sampled onto the deck.
    """
    coll=m.start_mod(GEN,mod_id)
    boot=m.base_mesh('Boot 6.001_157')
    half_span=460.0
    rise=34.0 if mod_id=='RA01' else 20.0
    depth=57.0 if mod_id=='RA01' else 43.0
    # Smooth rear-edge curve, symmetric about the measured ND centreline.
    def rear_z(x):
        u=abs(x)/half_span
        return -1840 + 34*u*u + 49*u**6
    rings=[]
    for i in range(81):
        x=-half_span+2*half_span*i/80
        u=abs(x)/half_span
        taper=1-smooth((u-0.80)/0.20)
        chord=depth*(0.54+0.46*taper)
        local_rise=2.2+(rise-2.2)*taper
        rear=rear_z(x)
        leading=rear+chord
        ring=[]
        # Front -> rear top, with rounded shoulder and rolled rear edge.
        profile=[(0,0.9),(0.06,1.6),(0.22,0.14*local_rise+1),
                 (0.48,0.43*local_rise),(0.76,0.79*local_rise),
                 (0.94,local_rise),(1,local_rise-0.8)]
        for t,lift in profile:
            z=leading-chord*t
            ring.append((x,height(boot,x,z)+max(GAP,lift),z))
        # Fitted underside follows the deck instead of leaving an open cavity.
        for t in [1,0.76,0.48,0.22,0]:
            z=leading-chord*t
            ring.append((x,height(boot,x,z)+GAP,z))
        rings.append(ring)
    material='MOD_BodyPaint' if mod_id=='RA01' else 'MOD_CarbonWeave'
    mesh_object(f'MOD_ND_{mod_id}_spoiler',rings,coll,material)
    return finish(coll)
