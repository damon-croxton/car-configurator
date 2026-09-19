"""Ten independently modeled ND parts, dimensions in measured app-space mm.

Wheel axle: (734, 320.5, 1194), contact patch (734, 0, 1194).
Body fixings are raycast against the named stock panels, never guessed from
nominal Mazda dimensions. No original meshes are changed or exported.
"""
import math
import bpy
from mathutils import Vector
import mx5_lib as m
import nd_street_kit as k
import nd_detail_kit as d
import nd_wheel_refinement as w


def wheel(ident):
    # Reuse the proven tyre, barrel and four-lug brake assembly, with a new face.
    coll=w.build('W07')
    for obj in list(coll.objects):
        if '_spoke_' in obj.name:
            bpy.data.objects.remove(obj,do_unlink=True)
    coll.name=f'MOD_ND_{ident}'
    for obj in coll.objects:
        obj.name=obj.name.replace('MOD_ND_W07_',f'MOD_ND_{ident}_')
    axle=w.AXLE
    split=ident=='W10'
    count=5 if split else 3
    for i in range(count):
        for branch in ([-1,1] if split else [0]):
            rings=[]
            for j in range(25):
                t=j/24
                r=61+188*t
                a=2*math.pi*i/count
                # Paired, splayed Y arms versus broad swept three-spoke paddles.
                a+=branch*(.05+.21*k.smooth((t-.08)/.92)) if split else -.22*t
                width=24-7*t if split else 66+38*math.sin(math.pi*t)-18*t
                x=43+48*t**1.7
                section=[(-15,-width/2+3),(-12,-width/2),(-3,-width/2),(0,-width/2+3),
                         (0,width/2-3),(-3,width/2),(-12,width/2),(-15,width/2-3)]
                rings.append([(axle[0]+x+dx,axle[1]+r*math.cos(a)-s*math.sin(a),
                               axle[2]+r*math.sin(a)+s*math.cos(a)) for dx,s in section])
            k.mesh_object(f'spoke_{i}_{branch}',rings,coll,'MOD_Rim')
    if not split:
        # Bright separate step lip makes the retro face easy to distinguish.
        d.lathe('polished_lip',coll,[(96,250),(99,253),(99,256),(96,258),(94,256),(94,251)],
                axle,'MOD_Chrome','x',80)
    angle=.55
    d.lathe('valve',coll,[(0,0),(0,4),(15,4),(17,3),(17,0)],
            (axle[0]+83,axle[1]+230*math.cos(angle),axle[2]+230*math.sin(angle)),d.SATIN,'x',12)
    return d.finish(coll)


def corner_splitters():
    coll=m.start_mod('nd','FA30')
    parts=[m.base_mesh(n) for n in ['BumperF 6.003_111','BumperF 6.002_110','BumperF 6.005_113']]
    for side in [-1,1]:
        rings=[]
        for i in range(51):
            t=i/50
            x=side*(400+394*t)
            bottom=next(y for y in range(155,350) if k.front_hit(parts,x,y) is not None)
            z=k.front_hit(parts,x,bottom+12).z
            taper=math.sin(math.pi*t)**.6
            front=z+8+55*taper
            y=bottom-3
            rings.append([(x,y,z-24),(x,y,front-3),(x,y-2,front),
                          (x,y-10,front),(x,y-12,front-3),(x,y-12,z-24)])
        k.mesh_object(f'corner_blade_{side}',rings,coll,d.CARBON)
    return d.finish(coll)


def race_skirts():
    coll=m.start_mod('nd','RA30')
    sill=m.base_mesh('Skirts 6.003_57')
    for side in [-1,1]:
        rings=[]
        for i in range(101):
            t=i/100
            z=-730+1515*t
            bottom=next(y for y in range(145,215) if k.ray(sill,(side*1200,y,z),(-side,0,0)) is not None)
            root=abs(k.ray(sill,(side*1200,bottom+8,z),(-side,0,0)).x)
            reach=12+60*k.smooth(min(t,1-t)/.08)
            outer=root+reach
            # Flat running blade with integral upturned outer fence at both ends.
            fence=28*(1-k.smooth(min(t,1-t)/.16))
            rings.append([(side*(root-14),bottom-2,z),(side*(root+2),bottom-2,z),
                          (side*(outer-4),bottom-2,z),(side*(outer-4),bottom+fence,z),
                          (side*outer,bottom+fence,z),(side*outer,bottom-9,z),
                          (side*(root-14),bottom-9,z)])
        k.mesh_object(f'running_blade_{side}',rings,coll,d.CARBON)
    return d.finish(coll)


def gurney():
    coll=m.start_mod('nd','RA31')
    boot=m.base_mesh('Boot 6.001_157')
    rings=[]
    for i in range(101):
        x=-475+950*i/100
        u=abs(x)/475
        z=-1835+34*u*u+60*u**6
        y=k.height(boot,x,z)
        fronty=k.height(boot,x,z+23)
        rise=8+21*(1-k.smooth((u-.85)/.15))
        rings.append([(x,fronty+.7,z+23),(x,fronty+3,z+23),(x,y+3,z+3),
                      (x,y+rise,z+3),(x,y+rise,z-1),(x,y+.7,z-1)])
    k.mesh_object('gurney_blade',rings,coll,d.SATIN)
    return d.finish(coll)


def pedestal_wing():
    coll=m.start_mod('nd','RA32')
    boot=m.base_mesh('Boot 6.001_157')
    rings=[]
    for i in range(81):
        x=-550+1100*i/80
        u=abs(x)/550
        y=990+11*u*u
        z=-1720+28*u*u
        # Low painted bridge spoiler, with rounded airfoil and tapered tips.
        chord=145-35*u**5
        section=[(0,0),(.08,8),(.3,14),(.65,12),(1,2),(.97,-3),(.5,-10),(.12,-9)]
        rings.append([(x,y+lift,z-chord*t) for t,lift in section])
    k.mesh_object('painted_airfoil',rings,coll,d.PAINT)
    for side in [-1,1]:
        x=side*330
        rings=[]
        for i in range(17):
            t=i/16
            z=-1735-28*t
            low=k.height(boot,x,-1735)
            y=low+(990-low)*t
            width=29-12*math.sin(math.pi*t)
            rings.append([(x-width,y,z-35),(x+width,y,z-35),
                          (x+width,y,z+35),(x-width,y,z+35)])
        k.mesh_object(f'pedestal_{side}',rings,coll,d.PAINT)
        d.plate(f'foot_{side}',coll,[(x-34,-1778),(x+34,-1778),(x+34,-1692),(x-34,-1692)],
                lambda xx,zz:k.height(boot,xx,zz)+3,3,d.PAINT)
    return d.finish(coll)


def exhaust(ident):
    coll=m.start_mod('nd',ident)
    twin=ident=='EX30'
    for i,x in enumerate([-330,-244] if twin else [-287]):
        r=37 if twin else 50
        profile=[(0,r-5),(-85,r-1),(-115,r),(-119,r-1),(-119,r-4),(-113,r-5),(-85,r-5),(0,r-9)]
        tip=d.lathe(f'tip_{i}',coll,profile,(x,221,-1760),
                    'MOD_Titanium' if twin else 'MOD_Chrome',segments=64)
        if twin:
            # A real angled opening, preserving the annular wall and empty bore.
            for v in tip.data.vertices:
                p=k.app(v.co)
                blend=k.smooth((-p.z-1810)/50)
                p.z-=.35*(p.y-221)*blend
                v.co=m.app_to_blender(*p)
        d.lathe(f'bore_{i}',coll,[(-8,0),(-8,r-9),(-82,r-6),(-82,r-8),(-12,r-11),(-12,0)],
                (x,221,-1760),d.SATIN,segments=40)
        d.tube(f'pipe_{i}',coll,[(x,221,-1760),(-287,221,-1580)],24,d.SATIN)
    d.lathe('silencer',coll,[(0,0),(0,55),(12,62),(170,62),(182,55),(182,0)],
            (-287,221,-1580),d.ALLOY,segments=40)
    return d.finish(coll)


def mud_flaps():
    coll=m.start_mod('nd','DT30')
    # Rearward wheel-arch lips: flaps overlap the body at the upper 50 mm,
    # and hang behind the tyre, clear of its 321 mm rolling envelope.
    for rear,z in [(False,795),(True,-1470)]:
        part=m.base_mesh('BumperR 6.001_146' if rear else 'Skirts 6.003_57')
        for side in [-1,1]:
            p=next((p for y in range(350,165,-5) if (p:=k.ray(part,(side*1200,y,z),(-side,0,0))) is not None),None)
            assert p is not None,(rear,side,z)
            outer=abs(p.x)+20
            outline=[(outer-125,p.y+15),(outer-12,p.y+24),(outer+3,p.y-7),(outer+3,118),
                     (outer-8,105),(outer-119,110),(outer-125,128)]
            k.mesh_object(f'flap_{rear}_{side}',[[(side*x,y,z+dz) for x,y in outline] for dz in [-2,2]],coll,'MOD_Rubber')
            for xx in [outer-100,outer-30]:
                d.lathe(f'fastener_{rear}_{side}_{xx:.0f}',coll,[(0,0),(0,5),(3,5),(3,0)],
                        (side*xx,p.y,z-4),d.ALLOY,segments=12)
    return d.finish(coll)


def rear_tow_eye():
    coll=m.start_mod('nd','DT31')
    bumper=m.base_mesh('BumperR 6.001_146')
    x,y=510,395
    hit=k.ray(bumper,(x,y,-2500),(0,0,1))
    assert hit is not None
    z=hit.z
    d.lathe('socket',coll,[(0,0),(0,17),(-5,17),(-5,0)],(x,y,z+1),d.SATIN)
    d.tube('shaft',coll,[(x,y,z+3),(x,y,z-53)],7,d.ALLOY)
    d.lathe('eye',coll,[(0,25),(0,36),(-7,36),(-9,33),(-9,25)],
            (x,y+29,z-49),'MOD_AccentPaint',segments=48)
    d.tube('neck',coll,[(x,y,z-45),(x,y+5,z-54)],9,'MOD_AccentPaint')
    return d.finish(coll)


BUILDERS={'W10':lambda:wheel('W10'),'W11':lambda:wheel('W11'),
          'FA30':corner_splitters,'RA30':race_skirts,'RA31':gurney,'RA32':pedestal_wing,
          'EX30':lambda:exhaust('EX30'),'EX31':lambda:exhaust('EX31'),
          'DT30':mud_flaps,'DT31':rear_tow_eye}
