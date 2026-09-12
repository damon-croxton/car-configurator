"""Refined generic wheel geometry: curved spokes, open faces, inset brakes."""
import math
import bpy
import mx5_lib as m
import nd_street_kit as k
import nd_detail_kit as d

AXLE=(734,320.5,1194)


def build(ident):
    coll=m.start_mod('nd',ident)
    count={'W01':6,'W04':8,'W05':16,'W07':6,'W09':10}[ident]
    dish=ident in ['W04','W05']
    outer_x=96
    # The visible lip follows the base tyre bead. Rim diameter and tread radius
    # stay independent in the app, preserving existing fitment controls.
    d.lathe('rim',coll,[(-100,254),(-96,258),(-87,258),(-80,246),
        (80,246),(89,258),(96,258),(99,255),(96,251),(85,239),(-87,239),(-100,250)],AXLE,'MOD_Rim','x',80)
    tyre=d.lathe('tyre',coll,m.tyre_profile(215.9,320.5,110,258/215.9),AXLE,'MOD_Tyre','x',80)
    for v in tyre.data.vertices:
        p=k.app(v.co)
        if p.y<5:p.y=0;v.co=m.app_to_blender(*p)
    face=28 if dish else 48
    d.lathe('hub',coll,[(face-15,0),(face-15,70),(face,70),(face+4,64),(face+4,0)],AXLE,'MOD_Rim','x',48)
    d.lathe('cap',coll,[(face+4,0),(face+4,31),(face+8,32),(face+11,28),(face+11,0)],AXLE,'MOD_Rim','x',40)
    for i in range(4):
        a=2*math.pi*i/4+math.pi/4
        centre=(AXLE[0],AXLE[1]+50*math.cos(a),AXLE[2]+50*math.sin(a))
        d.lathe(f'lug_{i}',coll,[(face+4,0),(face+4,7.5),(face+14,7.5),(face+14,0)],centre,'MOD_Chrome','x',6)
    for i in range(count):
        for branch in ([-1,1] if ident in ['W01','W05'] else [0]):
            rings=[]
            for j in range(15):
                t=j/14
                r=63+184*t
                a=2*math.pi*i/count
                if ident=='W05':a+=branch*0.43*t
                if ident=='W01':a+=branch*(0.08-0.03*t)
                width={'W01':18-4*t,'W04':34+15*math.sin(math.pi*t),
                       'W05':11-2*t,'W07':48-10*t,'W09':24-5*t}[ident]
                x=face-4+(outer_x-face-8)*(t**1.65)
                if dish:x-=17*math.sin(math.pi*t)
                centre=(AXLE[0]+x,AXLE[1]+r*math.cos(a),AXLE[2]+r*math.sin(a))
                # Chamfered 8-point section keeps highlights along the edges.
                section=[(-12,-width/2+2),(-10,-width/2),(-2,-width/2),(0,-width/2+2),
                         (0,width/2-2),(-2,width/2),(-10,width/2),(-12,width/2-2)]
                rings.append([(centre[0]+dx,centre[1]-s*math.sin(a),centre[2]+s*math.cos(a)) for dx,s in section])
            k.mesh_object(f'spoke_{i}_{branch}',rings,coll,'MOD_Rim')
    # Separate hardware is entirely behind the hub and spoke roots.
    d.lathe('disc',coll,[(-28,43),(-28,142),(-46,142),(-46,43)],AXLE,'MOD_Alloy','x',64)
    d.box('caliper',coll,(AXLE[0]-35,AXLE[1],AXLE[2]-147),(40,104,40),'MOD_CaliperPaint',7)
    return d.finish(coll)
