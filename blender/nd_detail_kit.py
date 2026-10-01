"""ND catalogue refinement, in measured app-space millimetres.

Generic visual concepts, not scans or manufacturing dimensions. The reference
body is read-only; replacement skins copy its perimeter before cutting vents.
"""
import math
import bpy
import bmesh
from mathutils import Vector
import mx5_lib as m
import nd_street_kit as k

SATIN = 'MOD_SatinBlack'
CARBON = 'MOD_CarbonWeave'
ALLOY = 'MOD_Alloy'
PAINT = 'MOD_BodyPaint'


def surface_material(obj, material):
    m.assign(obj, material)
    shader = obj.data.materials[0]
    bsdf = shader.node_tree.nodes.get('Principled BSDF')
    if material == CARBON:
        k.carbon_material(shader)
    elif material == SATIN:
        bsdf.inputs['Base Color'].default_value = (0.004, 0.005, 0.006, 1)
        bsdf.inputs['Metallic'].default_value = 0
        bsdf.inputs['Roughness'].default_value = 0.62
        bsdf.inputs['Specular IOR Level'].default_value = 0.18
    shader.diffuse_color = (0.45,0.008,0.012,1) if material == PAINT else (
        (0.25,0.27,0.29,1) if material in [ALLOY,'MOD_Chrome','MOD_Rim'] else (0.022,0.025,0.03,1))
    if material == 'MOD_AccentPaint':
        shader.diffuse_color = (0.4,0.01,0.015,1)
    return obj


def box(name, coll, centre, size, material=SATIN, bevel=1):
    o = m.block(name,coll,centre,size)
    if bevel:
        m.bevel_smooth(o,width=bevel/1000,segments=2)
    return surface_material(o,material)


def tube(name, coll, path, radius, material=SATIN, segments=12):
    return surface_material(m.sweep(name,coll,path,radius,segments=segments),material)


def lathe(name, coll, profile, centre, material=ALLOY, axis='z', segments=40):
    return surface_material(m.revolve(name,coll,profile,centre,segments=segments,axis=axis),material)


def plate(name, coll, outline, y, thick=4, material=SATIN):
    """Extrude a plan polygon; y may be a fitted surface function."""
    fn = y if callable(y) else lambda x,z:y
    rings = [[(x,fn(x,z)+dy,z) for x,z in outline] for dy in [-thick,0]]
    obj = k.mesh_object(name,rings,coll,material)
    # Caps of a nonplanar surface must be triangulated before export.
    return obj


def finish(coll):
    prefix=coll.name+'_'
    for obj in coll.objects:
        if obj.type != 'MESH':
            continue
        m.clean(obj)
        if not obj.data.uv_layers:
            m.box_uv(obj,scale=0.05)
        m.activate(obj)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        obj.data.set_sharp_from_angle(angle=math.radians(40))
        if not obj.name.startswith(prefix):
            obj.name=prefix+obj.name.split('.')[0].replace('-','neg')
    m.finalise_names(coll)
    return coll


def front_splitter():
    coll=m.start_mod('nd','FA03')
    bumper=m.base_mesh('BumperF 6.003_111')
    trim=m.base_mesh('BumperF 6.002_110')
    rings=[]
    for i in range(81):
        x=-810+i*1620/80
        # Sample the lower bumper's actual footprint; round the corner returns.
        hits=[k.ray(o,(x,y,2500),(0,0,-1)) for o in [bumper,trim,m.base_mesh('BumperF 6.005_113')] for y in [175,185,205,235,280,330]]
        front=max(h.z for h in hits if h is not None)
        t=abs(x)/810
        leading=front+65*(1-0.65*k.smooth((t-0.75)/0.25))
        back=front-120
        rings.append([(x,157,back),(x,157,leading-2),(x,155,leading),
                      (x,149,leading),(x,147,leading-2),(x,147,back)])
    k.mesh_object('blade',rings,coll,CARBON)
    for side in [-1,1]:
        x=side*480
        hit=k.ray(bumper,(x,440,2500),(0,0,-1))
        assert hit is not None
        lower=(x,157,1930)
        upper=(x,440,hit.z+4)
        tube(f'stay_{side}',coll,[lower,upper],4.2,ALLOY)
        direction=(Vector(upper)-Vector(lower)).normalized()
        tube(f'adjuster_{side}',coll,[Vector(lower)+direction*70,Vector(lower)+direction*125],6.5,SATIN)
        lathe(f'foot_{side}',coll,[(0,0),(0,13),(3,13),(3,0)],lower,ALLOY,'y',24)
        lathe(f'bumper_mount_{side}',coll,[(0,0),(0,12),(3,12),(3,0)],upper,SATIN,'z',24)
    return finish(coll)


def dive_planes():
    coll=m.start_mod('nd','FA05')
    bumper=m.base_mesh('BumperF 6.003_111')
    for side in [-1,1]:
        rings=[]
        for i in range(31):
            t=i/30
            z=1780-160*t
            y=395+38*t
            hit=k.ray(bumper,(side*1200,y,z),(-side,0,0))
            assert hit is not None,(y,z)
            root=hit.x-side*1.5
            width=3+65*math.sin(math.pi*t)**0.8
            tip=root+side*width
            rise=10*math.sin(math.pi*t)
            rings.append([(root,y+6,z),(tip,y+rise,z),(tip,y+rise-3,z),(root,y-3,z)])
        k.mesh_object(f'canard_{side}',rings,coll,CARBON)
    return finish(coll)


def tow_hook():
    coll=m.start_mod('nd','FA06')
    bumper=m.base_mesh('BumperF 6.003_111')
    x,y=-490,430
    h=k.ray(bumper,(x,y,2500),(0,0,-1))
    assert h is not None
    z=h.z
    lathe('socket',coll,[(0,0),(0,18),(6,18),(6,0)],(x,y,z-1),SATIN)
    lathe('shaft',coll,[(0,0),(0,7),(55,7),(55,0)],(x,y,z-5),ALLOY,segments=24)
    # Eye faces forward, joined at its lower edge to the threaded shaft.
    lathe('eye',coll,[(0,28),(0,40),(7,40),(9,37),(9,28)],(x,y+32,z+45),'MOD_AccentPaint',segments=48)
    tube('neck',coll,[(x,y,z+32),(x,y+5,z+49)],9,'MOD_AccentPaint')
    return finish(coll)


# diffuser(): superseded by nd_extras.rear_diffuser (RA04/RA04B).


def exhaust(ident):
    coll=m.start_mod('nd',ident)
    specs={'EX01':([-287],48,1), 'EX02':([-331,-243],37,1),
           'EX06':([-340,-234],46,0.72), 'EX03':([-331,-243,243,331],34,1)}
    xs,r,squash=specs[ident]
    cy=221
    for i,x in enumerate(xs):
        # Rolled edge, thin wall, open inner barrel; recessed dark termination.
        tip=lathe(f'tip_{i}',coll,[(0,r-5),(-85,r-1),(-105,r),(-108,r-1),
                  (-108,r-3),(-104,r-4),(-85,r-4),(0,r-8)],(x,cy,-1760),
                  'MOD_Titanium' if ident=='EX03' else 'MOD_Chrome',segments=40)
        bore=lathe(f'bore_{i}',coll,[(-10,0),(-10,r-9),(-88,r-4.5),(-88,r-6),(-12,r-11),(-12,0)],
                   (x,cy,-1760),SATIN,segments=32)
        if squash!=1:
            for o in [tip,bore]:
                for v in o.data.vertices:
                    p=k.app(v.co);p.y=cy+(p.y-cy)*squash;v.co=m.app_to_blender(*p)
        collector=287 if x>0 else -287
        tube(f'branch_{i}',coll,[(x,cy,-1760),(collector+(x-collector)*0.5,cy,-1630),(collector,cy,-1530)],22,SATIN)
    muffler=lathe('silencer',coll,[(0,0),(0,67),(15,76),(230,76),(245,67),(245,0)],(-287,cy,-1530),ALLOY,segments=32)
    for v in muffler.data.vertices:
        p=k.app(v.co);p.y=cy+(p.y-cy)*0.6;v.co=m.app_to_blender(*p)
    if ident=='EX03':
        tube('crossover',coll,[(-287,cy,-1510),(287,cy,-1510)],28,SATIN)
    return finish(coll)


def wing():
    coll=m.start_mod('nd','RA02')
    boot=m.base_mesh('Boot 6.001_157')
    rings=[]
    for i in range(29):
        x=-660+i*1320/28
        # Inverted camber, radiused nose and a fine trailing edge.
        y=1200+10*(abs(x)/660)**2
        z=-1610-14*(abs(x)/660)**2
        section=[(0,0),(10,5),(35,7),(90,7),(170,13),(220,22),
                 (220,19),(170,6),(90,-9),(35,-10),(10,-5)]
        rings.append([(x,y+dy,z-dz) for dz,dy in section])
    k.mesh_object('airfoil',rings,coll,CARBON)
    for side in [-1,1]:
        x=side*315
        # Three stations provide a swept thin upright, with a curved foot.
        z0=-1640
        y0=k.height(boot,x,z0)+3
        rings=[]
        for t in [0,0.1,0.85,1]:
            y=y0+(1190-y0)*t
            z=z0-40*t
            chord=110-42*t
            rings.append([(x-4,y,z+chord/2),(x+4,y,z+chord/2),
                          (x+4,y,z-chord/2),(x-4,y,z-chord/2)])
        k.mesh_object(f'upright_{side}',rings,coll,SATIN)
        # Fitted feet are segmented along the boot's slope.
        foot=[]
        for j in range(15):
            z=z0-72+j*144/14
            a,b=x-35,x+35
            ya,yb=k.height(boot,a,z)+3,k.height(boot,b,z)+3
            foot.append([(a,ya,z),(b,yb,z),(b,yb-3,z),(a,ya-3,z)])
        k.mesh_object(f'foot_{side}',foot,coll,SATIN)
        for dz in [-55,55]:
            lathe(f'bolt_{side}_{dz}',coll,[(0,0),(0,5),(3,5),(3,0)],
                  (x,k.height(boot,x,z0+dz)+4,z0+dz),ALLOY,'y',6)
        # Shaped endplate rather than a rectangular billboard.
        outline=[(-1588,1240),(-1605,1260),(-1815,1255),(-1860,1200),(-1838,1135),(-1640,1146),(-1588,1170)]
        rings=[[(side*663+dx,y,z) for z,y in outline] for dx in [-2,2]]
        k.mesh_object(f'endplate_{side}',rings,coll,CARBON)
    return finish(coll)


def antenna(ident):
    coll=m.start_mod('nd',ident)
    # Match the quarter-panel tangent over the small mounting footprint.
    quarter=m.base_mesh('FendersR 6.001_40')
    x,z=-581,-1600
    y=k.height(quarter,x,z)
    profile=[(0,0),(0,16),(2,17),(4,14),(4,0)] if ident=='DT02' else [
        (0,0),(0,16),(3,17),(6,14),(10,10),(67,6),(78,4),(80,0)]
    o=lathe('plug' if ident=='DT02' else 'mast',coll,profile,(x,y,z),SATIN,'y',32)
    for v in o.data.vertices:
        p=k.app(v.co)
        # Foot follows the panel; mast remains mostly upright with a small rake.
        h=k.height(quarter,p.x,p.z)
        lift=p.y-y
        p.y+=h-y
        p.z-=lift*0.12
        v.co=m.app_to_blender(*p)
    return finish(coll)


def pins():
    coll=m.start_mod('nd','DT07')
    hood=m.base_mesh('Hood 6.001_120')
    for side in [-1,1]:
        x,z=side*525,1580
        y=k.height(hood,x,z)
        lathe(f'plate_{side}',coll,[(0,0),(0,23),(2,24),(3,21),(3,0)],(x,y,z),SATIN,'y',32)
        lathe(f'pin_{side}',coll,[(0,0),(0,4),(12,4),(12,0)],(x,y+3,z),ALLOY,'y',16)
        path=[]
        for i in range(25):
            a=2*math.pi*i/24
            path.append((x+12*math.cos(a),y+10,z+5+8*math.sin(a)))
        tube(f'clip_{side}',coll,path,1.4,ALLOY,8)
        # Thin curved tether lies just above the skin, with both ends attached.
        path=[]
        for i in range(25):
            t=i/24
            px=x+side*30*math.sin(math.pi*t);pz=z-95*t
            path.append((px,k.height(hood,px,pz)+3,pz))
        tube(f'tether_{side}',coll,path,0.85,SATIN,6)
        lathe(f'anchor_{side}',coll,[(0,0),(0,4),(3,4),(3,0)],path[-1],ALLOY,'y',12)
    return finish(coll)


def strap():
    coll=m.start_mod('nd','DT08')
    x=-480
    rings=[]
    # Rounded hanging loop; the two ends meet at the same mounting bolt.
    for i in range(49):
        a=2*math.pi*i/48
        y=201+57*math.cos(a)
        z=-1887-17*math.sin(a)
        normal=Vector((0,17*math.cos(a),-57*math.sin(a))).normalized()
        rings.append([(x-18,y+normal.y*1.2,z+normal.z*1.2),
                      (x+18,y+normal.y*1.2,z+normal.z*1.2),
                      (x+18,y-normal.y*1.2,z-normal.z*1.2),
                      (x-18,y-normal.y*1.2,z-normal.z*1.2)])
    webbing=k.mesh_object('webbing',rings,coll,'MOD_AccentPaint')
    bm=bmesh.new();bm.from_mesh(webbing.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=list(bm.faces)[-2:],context='FACES_ONLY')
    bm.to_mesh(webbing.data);bm.free()
    lathe('bolt',coll,[(0,0),(0,9),(-5,9),(-5,0)],(x,255,-1890),ALLOY,'z',6)
    tube('bracket',coll,[(x,255,-1890),(x,255,-1830)],8,SATIN)
    return finish(coll)


def roll_bar(ident):
    coll=m.start_mod('nd',ident)
    # Main hoop lies behind the seats, forward of the sloping rear window.
    # Its crown clears the canvas in both roof states.
    x,z,top=470,-740,1090
    path=m.rounded_path([(-x,735,z),(-x,top,z),(x,top,z),(x,735,z)],95,12)
    tube('main_hoop',coll,path,20,SATIN,16)
    for side in [-1,1]:
        tube(f'rear_stay_{side}',coll,[(side*350,1089,z),(side*420,738,-1020)],17.5,SATIN,12)
        box(f'front_foot_{side}',coll,(side*x,734,z),(85,6,95),SATIN,3)
        box(f'rear_foot_{side}',coll,(side*420,736,-1020),(85,6,95),SATIN,3)
    if ident=='RB02':
        tube('harness_bar',coll,[(-468,855,z),(468,855,z)],17.5,SATIN,12)
        tube('diagonal',coll,[(-430,772,z),(380,1087,z)],17.5,SATIN,12)
    return finish(coll)


def clipped_skin(coll, name, source, holes, material):
    """Clip original triangles against convex footprints, keeping exact edges.

    Unlike centre-of-face deletion, this does not leave sawtooth apertures or
    require subdivision of un-welded imported vertices. No base mesh is edited.
    """
    verts,faces=[],[]
    source.data.calc_loop_triangles()
    def split(poly,a,b):
        def distance(p):return (b[0]-a[0])*(p.z-a[1])-(b[1]-a[1])*(p.x-a[0])
        inside,outside=[],[]
        for p,q in zip(poly,poly[1:]+poly[:1]):
            dp,dq=distance(p),distance(q)
            # Boundary points belong to BOTH polygons. The second aperture
            # reuses the first cut's stations; losing those points cuts a
            # spurious band across the entire bonnet.
            if dp>=-1e-7:inside.append(p)
            if dp<=1e-7:outside.append(p)
            if (dp>0 and dq<0) or (dp<0 and dq>0):
                point=p.lerp(q,dp/(dp-dq))
                inside.append(point);outside.append(point)
        return inside,outside
    for tri in source.data.loop_triangles:
        pieces=[[k.app(source.matrix_world@source.data.vertices[i].co) for i in tri.vertices]]
        for hole in holes:
            rest=[]
            for poly in pieces:
                candidate=poly
                for a,b in zip(hole,hole[1:]+hole[:1]):
                    candidate,outside=split(candidate,a,b)
                    if len(outside)>=3:rest.append(outside)
                    if len(candidate)<3:break
            pieces=rest
        for poly in pieces:
            start=len(verts)
            verts.extend(m.app_to_blender(*p) for p in poly)
            faces.extend((start,start+j,start+j+1) for j in range(1,len(poly)-1))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh);coll.objects.link(obj)
    surface_material(obj,material)
    m.clean(obj)
    # WELD first, then add thickness, so adjacent faces share the same offset.
    m.solidify(obj,2)
    for face in obj.data.polygons:
        face.use_smooth=True
    m.box_uv(obj,scale=0.05)
    return obj


def bonnet(ident):
    coll=m.start_mod('nd',ident)
    source=m.base_mesh('Hood 6.001_120')
    if ident=='BP01':
        holes=[[(cx-130,1065),(cx+130,1065),(cx+130,1315),(cx-130,1315)] for cx in [-315,315]]
        clipped_skin(coll,'panel',source,holes,CARBON)
        for side,cx in enumerate([-315,315]):
            # Five rearward-facing louvres follow the bonnet at every station.
            for i in range(5):
                rear=1070+i*49
                rings=[]
                for j in range(21):
                    x=cx-134+j*268/20
                    z0,z1=rear,rear+45
                    y0=k.height(source,x,z0)+3
                    y1=k.height(source,x,z1)-17
                    rings.append([(x,y0,z0),(x,y1,z1),(x,y1-2,z1),(x,y0-2,z0)])
                k.mesh_object(f'louvre_{side}_{i}',rings,coll,SATIN)
            # Thin perimeter frame follows the skin; no bulky raised boxes.
            for x in [cx-132,cx+132]:
                rows=[]
                for i in range(31):
                    z=1062+i*256/30
                    rows.append([(x-4,k.height(source,x-4,z)+2,z),(x+4,k.height(source,x+4,z)+2,z),
                                 (x+4,k.height(source,x+4,z)-2,z),(x-4,k.height(source,x-4,z)-2,z)])
                k.mesh_object(f'rail_{side}_{x}',rows,coll,SATIN)
    else:
        # One precisely bounded inlet. The old cut predicate also deleted a
        # strip all the way back to the cowl, corrupting the bonnet silhouette.
        outline=[(-90,1050),(90,1050),(12,1420),(-12,1420)]
        clipped_skin(coll,'panel',source,[outline],PAINT)
        rows=[]
        for i in range(41):
            t=i/40;z=1420-370*t;w=12+78*t
            y=k.height(source,0,z)-37*t**1.4
            rows.append([(-w,y,z),(w,y,z),(w,y-2,z),(-w,y-2,z)])
        k.mesh_object('inlet_floor',rows,coll,SATIN)
        for side in [-1,1]:
            rows=[]
            for i in range(41):
                t=i/40;z=1420-370*t;x=side*(12+78*t)
                upper=k.height(source,x,z)
                lower=k.height(source,0,z)-37*t**1.4-1
                rows.append([(x-side*1.5,upper,z),(x+side*1.5,upper,z),
                             (x+side*1.5,lower,z),(x-side*1.5,lower,z)])
            k.mesh_object(f'inlet_wall_{side}',rows,coll,SATIN)
        # Dark recessed throat, 35 mm down; no plate at the surface opening.
        box('throat',coll,(0,k.height(source,0,1050)-20,1046),(178,37,3),SATIN,0)
    return finish(coll)


def carbon_boot():
    coll=m.start_mod('nd','BP04')
    source=m.base_mesh('Boot 6.001_157')
    clipped_skin(coll,'lid',source,[],CARBON)
    return finish(coll)
