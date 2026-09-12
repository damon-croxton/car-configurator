"""Original ND aero concepts, informed by the supplier photos in ND-AERO-REFERENCES.md.

All dimensions are viewer fitment choices in app-space mm, not product measurements.
The base car stays read-only. Closed lofts carry real mounting flanges and returns.
"""
import math
from mathutils import Vector
import mx5_lib as m
import nd_street_kit as k
import nd_detail_kit as d


def front_lip(ident):
    coll=m.start_mod('nd',ident)
    parts=[m.base_mesh(n) for n in ['BumperF 6.003_111','BumperF 6.002_110','BumperF 6.005_113']]
    def sample(x):
        bottom=next(y for y in range(155,340) if k.front_hit(parts,x,y) is not None)
        p=k.front_hit(parts,x,bottom+12)
        return bottom,p.z
    # Smooth the visible leading edge across the original grille/bumper seams.
    samples=[sample(-805+i*1610/160) for i in range(161)]
    def rail(x):
        n=round((x+805)/1610*160)
        weights=[(j,math.exp(-((j-n)/5)**2)) for j in range(max(0,n-10),min(161,n+11))]
        return sum(samples[j][1]*w for j,w in weights)/sum(w for _,w in weights)
    split=ident=='FA20'
    spans=[(-775,-25),(25,775)] if split else [(-775,-390),(-387,387),(390,775)]
    for piece,(a,b) in enumerate(spans):
        rings=[]
        for i in range(65):
            x=a+(b-a)*i/64
            bottom,z=sample(x)
            end=abs(x)/805
            front=rail(x)+(30 if split else 50)
            low=(157 if split else 149)+10*k.smooth((end-.8)/.2)
            inner=Vector((x,bottom-1,z-5))
            outer=Vector((x,low+8,front))
            top=[]
            for t in [0,.15,.4,.7,.92,1]:
                p=inner.lerp(outer,t)
                hits=[k.ray(part,(p.x,0,p.z),(0,1,0)) for part in parts]
                levels=[h.y-1 for h in hits if h is not None]
                if levels:p.y=min(p.y,min(levels))
                top.append(tuple(p))
            rings.append(top+[(px,py-(8 if split else 12),pz) for px,py,pz in reversed(top)])
        k.mesh_object(f'lip_section_{piece}',rings,coll,d.CARBON if split else d.SATIN)
    if not split:
        # Three small raised centre ribs, characteristic of a moulded lip.
        for x in [-240,0,240]:
            front=rail(x)+49
            outline=[(x-4,151,front-34),(x-4,173,front-31),(x-4,159,front),(x-4,151,front)]
            k.mesh_object(f'centre_rib_{x}',[outline,[(px+8,y,z) for px,y,z in outline]],coll,d.SATIN)
    return d.finish(coll)


def skirts(ident):
    coll=m.start_mod('nd',ident)
    sill=m.base_mesh('Skirts 6.003_57')
    rs=ident=='RA21'
    for side in [-1,1]:
        rings=[]
        for i in range(121):
            t=i/120
            z=-743+1555*t
            bottom=next(y for y in range(145,210) if k.ray(sill,(side*1200,y,z),(-side,0,0)) is not None)
            def sx(y):
                p=k.ray(sill,(side*1200,y,z),(-side,0,0))
                assert p is not None,(ident,y,z)
                return abs(p.x)
            taper=k.smooth(min(t,1-t)/.065)
            high=bottom+(8+85*math.sin(math.pi*t)**.65 if rs else 15+24*(1-k.smooth(t/.18)))
            reach=(15+31*taper) if not rs else (12+29*math.sin(math.pi*t)**.7)
            low=bottom-(16 if not rs else 22)*taper-3
            xt,xb=sx(high),sx(bottom+2)
            rings.append([(side*(xt+1),high,z),(side*(xt+5),high+1,z),
                          (side*(xb+reach-3),bottom+3,z),(side*(xb+reach),low+4,z),
                          (side*(xb+reach-3),low,z),(side*(xb-12),low,z),
                          (side*(xb-12),bottom-2,z),(side*(xb+1),bottom+2,z)])
        k.mesh_object(f'skirt_{side}',rings,coll,d.CARBON)
    return d.finish(coll)


def spoiler(ident):
    coll=m.start_mod('nd',ident)
    boot=m.base_mesh('Boot 6.001_157')
    msr=ident=='RA22'
    half=480
    rings=[]
    for i in range(121):
        x=-half+2*half*i/120
        u=abs(x)/half
        rear=-1834+34*u*u+63*u**6
        taper=1-k.smooth((u-.82)/.18)
        if msr:
            # A thin upright trailing blade with a lower centre section.
            rise=(28+25*k.smooth((abs(x)-125)/18))*(.45+.55*taper)
            base=k.height(boot,x,rear)+1
            front=rear+34
            fronty=k.height(boot,x,front)+1
            rings.append([(x,fronty,front),(x,fronty+4,front),
                          (x,base+rise-2,rear-14),(x,base+rise,rear-18),
                          (x,base+rise-1,rear-22),(x,base,rear-2)])
        else:
            # Broader moulded ducktail: rounded shoulder, curved plan and
            # tapered ends instead of a vertical plank or flat box.
            # Keep the original centre deck detail clear of the leading seam.
            chord=(80-25*math.exp(-(x/100)**4))*(.4+.6*taper)
            rise=7+65*taper
            ring=[]
            for t,lift in [(0,1),(.1,2),(.28,.18*rise),(.53,.55*rise),
                           (.78,.92*rise),(.94,rise),(1,.97*rise)]:
                z=rear+chord*(1-t)
                ring.append((x,k.height(boot,x,z)+max(1,lift),z))
            for t in [1,.78,.53,.28,0]:
                z=rear+chord*(1-t)
                ring.append((x,k.height(boot,x,z)+1,z))
            rings.append(ring)
    k.mesh_object('spoiler',rings,coll,d.CARBON if msr else d.PAINT)
    return d.finish(coll)


def swan_wing():
    coll=m.start_mod('nd','RA24')
    boot=m.base_mesh('Boot 6.001_157')
    # Inverted airfoil, swept slightly forwards towards the tips.
    section=[(0,0),(.04,7),(.15,11),(.35,9),(.65,4),(1,0),
             (.99,-4),(.7,-14),(.35,-24),(.12,-19),(.025,-8)]
    rings=[]
    for i in range(81):
        x=-710+i*1420/80
        u=abs(x)/710
        # The leading edge sits behind the original whip antenna at z=-1600.
        z=-1690+45*u*u
        y=1070+18*u*u
        rings.append([(x,y+lift,z-210*t) for t,lift in section])
    k.mesh_object('airfoil',rings,coll,d.CARBON)
    for side in [-1,1]:
        x=side*330
        y=k.height(boot,x,-1660)+2
        # Wide, surface-conforming feet, with bolts clear of the deck edge.
        foot=[]
        for j in range(9):
            z=-1730+j*135/8
            y0,y1=k.height(boot,x-24,z)+1,k.height(boot,x+24,z)+1
            foot.append([(x-24,y0,z),(x+24,y1,z),(x+24,y1+7,z),(x-24,y0+7,z)])
        k.mesh_object(f'foot_{side}',foot,coll,d.SATIN)
        # Swept swan neck: the support approaches the top of the airfoil,
        # leaving the underside uninterrupted. Closed 8 mm aluminium plate.
        outline=[(y+6,-1710),(y+6,-1625),(995,-1570),(1103,-1630),
                 (1122,-1665),(1122,-1770),(1080,-1820),(1078,-1792),
                 (1096,-1750),(1096,-1680),(1084,-1662),(997,-1616)]
        k.mesh_object(f'swan_neck_{side}',[[(x+dx,yy,z) for yy,z in outline] for dx in [-4,4]],coll,d.SATIN)
        for z in [-1716,-1608]:
            d.lathe(f'bolt_{side}_{z}',coll,[(0,0),(0,5),(4,5),(4,0)],
                    (x,k.height(boot,x,z)+8,z),d.ALLOY,'y',12)
        # Tapered endplate follows the section, rather than a rectangular slab.
        outline=[(1101,-1637),(1116,-1710),(1104,-1854),(1033,-1865),
                 (1020,-1730),(1042,-1637)]
        k.mesh_object(f'endplate_{side}',[[(side*(714+dx),yy,z) for yy,z in outline] for dx in [-2,2]],coll,d.CARBON)
    return d.finish(coll)


def stacked_canards():
    coll=m.start_mod('nd','FA22')
    bumper=m.base_mesh('BumperF 6.003_111')
    for side in [-1,1]:
        for level in range(2):
            rings=[]
            for i in range(41):
                t=i/40
                z=1780-(160-25*level)*t-20*level
                y=395+70*level+(38-10*level)*t
                hit=k.ray(bumper,(side*1200,y,z),(-side,0,0))
                assert hit is not None,(y,z)
                root=hit.x-side
                width=3+(64-12*level)*math.sin(math.pi*t)**.65
                tip=root+side*width
                rise=13*math.sin(math.pi*t)
                rings.append([(root,y+7,z),(tip,y+rise,z),(tip,y+rise-3.5,z),(root,y-3,z)])
            k.mesh_object(f'dive_plane_{side}_{level}',rings,coll,d.CARBON)
    return d.finish(coll)


def street_diffuser():
    coll=m.start_mod('nd','RA25')
    parts=[m.base_mesh(n) for n in ['BumperR 6.001_146','BumperR 6.002_147','BumperR 6_145','BumperR 6.004_149']]
    def back(x,y):
        hits=[k.ray(p,(x,y,-2500),(0,0,1)) for p in parts]
        hits=[p for p in hits if p is not None]
        assert hits,(x,y)
        return min(p.z for p in hits)
    def bottom_at(x):
        for y in range(175,350):
            if any(k.ray(p,(x,y,-2500),(0,0,1)) is not None for p in parts):return y
        raise ValueError(('No rear hem',x))
    rings=[]
    for i in range(145):
        x=-680+1360*i/144
        # Follow the actual hem, including the existing exhaust arch. Mirror
        # that clearance to accept twin and quad outlet configurations.
        bottom=max(bottom_at(x),bottom_at(-x))
        top=bottom+13
        z=back(x,top)
        low=bottom-11
        rings.append([(x,top,z-1),(x,top+1,z-4),(x,low+7,z-22),
                      (x,low,z-21),(x,low,z+13),(x,bottom-1,z+13)])
    k.mesh_object('curved_valance',rings,coll,d.SATIN)
    for x in [-170,-57,57,170]:
        rings=[]
        for i in range(31):
            t=i/30
            z=-1680-187*t
            y=220+25*t
            drop=8+44*t
            rings.append([(x-2.5,y,z),(x+2.5,y,z),(x+2.5,y-drop,z),(x-2.5,y-drop,z)])
        k.mesh_object(f'fin_{x}',rings,coll,d.SATIN)
    d.plate('undertray',coll,[(-183,-1675),(183,-1675),(184,-1868),(-184,-1868)],
            lambda x,z:220+25*(-z-1680)/187,5,d.SATIN)
    return d.finish(coll)


def rear_spats():
    coll=m.start_mod('nd','RA26')
    bumper=m.base_mesh('BumperR 6.001_146')
    for side in [-1,1]:
        rings=[]
        for i in range(51):
            t=i/50
            z=-1490-265*t
            bottom=next(y for y in range(170,400) if k.ray(bumper,(side*1200,y,z),(-side,0,0)) is not None)
            y=bottom+15
            hit=k.ray(bumper,(side*1200,y,z),(-side,0,0))
            assert hit is not None,(y,z)
            root=abs(hit.x)
            taper=math.sin(math.pi*t)**.6
            reach=4+39*taper
            low=bottom-9-10*taper
            rings.append([(side*(root+1),y,z),(side*(root+5),y+1,z),
                          (side*(root+reach),low+6,z),(side*(root+reach-2),low,z),
                          (side*(root-15),low,z),(side*(root-15),bottom-1,z)])
        k.mesh_object(f'spat_{side}',rings,coll,d.CARBON)
    return d.finish(coll)


BUILDERS={
    'FA20':lambda:front_lip('FA20'),'FA21':lambda:front_lip('FA21'),
    'FA22':stacked_canards,'RA20':lambda:skirts('RA20'),
    'RA21':lambda:skirts('RA21'),'RA22':lambda:spoiler('RA22'),
    'RA23':lambda:spoiler('RA23'),'RA24':swan_wing,
    'RA25':street_diffuser,'RA26':rear_spats,
}
