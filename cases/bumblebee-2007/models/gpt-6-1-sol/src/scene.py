"""Independent procedural Bumblebee study. Blender 4.5; no external model assets.

Coordinates: X right, -Y forward, Z up. All dimensions are artistic estimates.
Every assembly has a fixed identity and scale in both endpoints.
"""
import bpy, math, random, json, sys, argparse, hashlib
from pathlib import Path
from mathutils import Vector, Euler

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / 'artifacts'
OUT.mkdir(exist_ok=True)
FPS, DURATION = 24, 22
RNG = random.Random(127)
ASSEMBLIES = []
PARTS = []

def material(name, color, metal=0, rough=.35, emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    n=m.node_tree.nodes; p=n.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    if name in ('Signal yellow enamel','Obsidian racing stripe'):
        p.inputs['Coat Weight'].default_value=.5;p.inputs['Coat Roughness'].default_value=.2
        tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=175
        ramp=n.new('ShaderNodeMapRange');ramp.inputs['To Min'].default_value=.23;ramp.inputs['To Max'].default_value=.34
        m.node_tree.links.new(tex.outputs['Fac'],ramp.inputs[0]);m.node_tree.links.new(ramp.outputs[0],p.inputs['Roughness'])
        bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.06;bump.inputs['Distance'].default_value=.009
        m.node_tree.links.new(tex.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs[0],p.inputs['Normal'])
    return m

def setup_materials():
    global YELLOW,BLACK,STEEL,DARK,CHROME,RUBBER,GLASS,BLUE,WHITE,AMBER,GROUND
    YELLOW=material('Signal yellow enamel',(.64,.28,.006),.48,.3)
    BLACK=material('Obsidian racing stripe',(.009,.014,.019),.6,.28)
    STEEL=material('Brushed titanium',(.27,.31,.34),.88,.31)
    DARK=material('Recessed gunmetal',(.037,.049,.058),.83,.34)
    CHROME=material('Machined aluminium',(.36,.41,.45),.95,.27)
    RUBBER=material('Tire rubber',(.012,.016,.019),.05,.72)
    GLASS=material('Smoked automotive glass',(.019,.052,.073),.78,.13)
    BLUE=material('Ion blue optics',(.015,.23,.8),.35,.2,2.3)
    WHITE=material('Projector headlight',(.65,.85,1),.2,.18,3)
    AMBER=material('Amber running light',(1,.23,.018),.1,.2,2)
    GROUND=material('Wet basalt',(.035,.045,.051),.52,.28)

def finish(obj,name,mat,parent=None):
    obj.name=name
    if mat:obj.data.materials.append(mat)
    if parent:obj.parent=parent
    if parent:PARTS.append({'id':name,'assembly':parent.name})
    return obj

def box(name,loc,size,mat,parent=None,bevel=.035,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.rotation_euler=rot
    if bevel:
        b=o.modifiers.new('manufactured edge radius','BEVEL');b.width=bevel;b.segments=3
        o.modifiers.new('weighted corner normals','WEIGHTED_NORMAL')
    return finish(o,name,mat,parent)

def ellipsoid(name,loc,size,mat,parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc);o=bpy.context.object;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat,parent)

def cylinder(name,loc,r,depth,mat,parent=None,axis='Z',vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc)
    o=bpy.context.object
    if axis=='X':o.rotation_euler[1]=math.pi/2
    if axis=='Y':o.rotation_euler[0]=math.pi/2
    b=o.modifiers.new('edge highlights','BEVEL');b.width=min(.018,r*.12);b.segments=2
    o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat,parent)

def rod(name,a,b,r,mat,parent=None):
    a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,r,(b-a).length,mat,parent)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def torus(name,loc,major,minor,mat,parent=None,axis='Y'):
    bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=12,location=loc,major_radius=major,minor_radius=minor)
    o=bpy.context.object
    if axis=='Y':o.rotation_euler[0]=math.pi/2
    if axis=='X':o.rotation_euler[1]=math.pi/2
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat,parent)

def plate(name,outline,depth,mat,parent=None,loc=(0,0,0),rot=(0,0,0),bevel=.025):
    # Outline in local XZ plane, front faces -Y.
    n=len(outline);verts=[(x,y,z) for y in (-depth/2,depth/2) for x,z in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=rot
    if bevel:
        b=o.modifiers.new('rolled edge','BEVEL');b.width=bevel;b.segments=3;o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
    return finish(o,name,mat,parent)

def assembly(name,robot,car,rr=(0,0,0),cr=(0,0,0),delay=0):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o)
    ASSEMBLIES.append({'id':name,'object':o,'robot':robot,'car':car,'rr':rr,'cr':cr,'delay':delay})
    o.location=robot;o.rotation_euler=rr;return o

def bolt(name,loc,parent,r=.035,axis='Y'):
    cylinder(name,loc,r,.027,CHROME,parent,axis,6)

def arch(name,parent):
    verts=[];faces=[];steps=24
    for x in (-.17,.17):
        for radius in (.51,.63):
            for j in range(steps+1):
                a=j*math.pi/steps
                verts.append((x,radius*math.cos(a),radius*math.sin(a)))
    n=steps+1
    for j in range(steps):
        faces.extend([(j,j+1,n+j+1,n+j),(2*n+j,3*n+j,3*n+j+1,2*n+j+1),(j,2*n+j,2*n+j+1,j+1),(n+j,n+j+1,3*n+j+1,3*n+j)])
    faces.extend([(0,n,3*n,2*n),(n-1,2*n-1,4*n-1,3*n-1)])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    b=o.modifiers.new('fender rolled seam','BEVEL');b.width=.014;b.segments=2;o.modifiers.new('smooth arch normals','WEIGHTED_NORMAL')
    return finish(o,name,YELLOW,parent)

def wheel(name,parent,loc=(0,0,0)):
    x,y,z=loc
    torus(name+'.tire',loc,.365,.135,RUBBER,parent,'X')
    cylinder(name+'.rim',(x+.02,y,z),.325,.23,DARK,parent,'X')
    torus(name+'.rim_lip',(x-.14,y,z),.296,.019,CHROME,parent,'X')
    cylinder(name+'.rotor',(x-.105,y,z),.245,.035,STEEL,parent,'X')
    cylinder(name+'.hub',(x-.175,y,z),.09,.055,CHROME,parent,'X')
    for j in range(5):
        a=j*math.tau/5
        rod(name+'.spoke'+str(j),(x-.15,y+.075*math.sin(a),z+.075*math.cos(a)),(x-.15,y+.285*math.sin(a+.18),z+.285*math.cos(a+.18)),.032,CHROME,parent)
        bolt(name+'.lug'+str(j),(x-.21,y+.06*math.sin(a),z+.06*math.cos(a)),parent,.018,'X')
    for j in range(32):
        a=j*math.tau/32
        o=box(name+'.tread'+str(j),(x,y+.488*math.sin(a),z+.488*math.cos(a)),(.22,.047,.017),DARK,parent,.005)
        o.rotation_euler[0]=-a
    # Rims are visible from both sides; a closed disc is not a rim.
    for side in (-1,1):
        xx=x+side*.17
        torus(name+f'.outer_lip{side}',(xx,y,z),.296,.019,CHROME,parent,'X')
        cylinder(name+f'.outer_hub{side}',(xx,y,z),.087,.045,CHROME,parent,'X')
        for j in range(5):
            a=j*math.tau/5
            rod(name+f'.outer_spoke{side}.{j}',(xx,y+.075*math.sin(a),z+.075*math.cos(a)),(xx,y+.285*math.sin(a+.18),z+.285*math.cos(a+.18)),.036,CHROME,parent)

def model():
    # Exposed torso: mechanical spine, rib rails, ribbed abdominal turbine.
    t=assembly('torso',(0,.08,3.78),(0,0,.8),delay=.12)
    box('torso.frame',(0,0,0),(.8,.55,1.1),DARK,t,.08)
    cylinder('torso.turbine',(0,-.32,-.1),.32,.15,STEEL,t,'Y')
    torus('torso.turbine_rim',(0,-.42,-.1),.24,.035,CHROME,t)
    for j in range(12):
        a=j*math.tau/12
        o=box('torso.turbine_blade'+str(j),(.2*math.sin(a),-.44,-.1+.2*math.cos(a)),(.045,.03,.13),DARK,t,.008,rot=(0,a,0))
    for s in (-1,1):
        for j in range(5):
            rod(f'torso.rib{s}.{j}',(s*.08,-.35,-.42+j*.16),(s*(.3+.055*j),-.22,-.34+j*.16),.045,STEEL,t)
        rod(f'torso.strut{s}',(s*.35,-.33,-.55),(s*.56,-.16,.58),.055,CHROME,t)
        for j in range(5):bolt(f'torso.fastener{s}.{j}',(s*.38,-.35,-.4+j*.19),t,.027)
        for j in range(3):
            rod(f'torso.hydraulic{s}.{j}',(s*(.22+j*.065),-.32,-.42),(s*(.32+j*.09),-.21,.5),.022,CHROME,t)
    neck=assembly('neck',(0,.08,4.99),(0,0,.64),cr=(math.pi/2,0,0),delay=.44)
    for s in (-1,1):rod(f'neck.rail{s}',(s*.12,0,-.22),(s*.1,0,.22),.042,STEEL,neck)
    for j in range(5):cylinder(f'neck.collar{j}',(0,.03,-.16+j*.075),.13,.035,DARK,neck)
    hip=assembly('pelvis',(0,.1,2.94),(0,.45,.66),delay=.06)
    box('pelvis.housing',(0,0,0),(.82,.56,.44),DARK,hip,.09)
    plate('pelvis.front',[(-.42,.15),(-.18,.33),(.18,.33),(.42,.15),(.19,-.33),(0,-.4),(-.19,-.33)],.12,STEEL,hip,(0,-.33,0))
    plate('pelvis.yellow_crest',[(-.2,.27),(.2,.27),(.12,.03),(-.12,.03)],.045,YELLOW,hip,(0,-.42,0))
    for j in range(3):box(f'pelvis.center_rail{j}',(-.09+j*.09,-.43,-.03),(.028,.035,.32),CHROME,hip,.008)
    # Split Camaro nose: broad curved hood with black stripes and recessed lamps.
    for s in (-1,1):
        c=assembly(f'chest.{s}',(s*.55,-.26,4.53),(s*.51,-1.84,1.03),rr=(.1,s*.07,s*-.09),delay=.24)
        outline=[(-.49,.15),(-.38,.23),(.4,.23),(.53,.13),(.5,-.23),(.2,-.3),(-.42,-.23)]
        plate(f'chest{s}.body',outline,.38,YELLOW,c)
        box(f'chest{s}.hood',(0,.47,.26),(.99,1.2,.085),YELLOW,c,.07,rot=(.10,0,0))
        box(f'chest{s}.racing_stripe',(s*-.18,.46,.309),(.22,1.2,.011),BLACK,c,.005,rot=(.10,0,0))
        box(f'chest{s}.lamp_recess',(s*.20,-.211,.12),(.47,.045,.15),BLACK,c,.025)
        for j in range(2):
            xx=s*(.11+j*.19)
            cylinder(f'chest{s}.projector{j}',(xx,-.249,.12),.064,.031,CHROME,c,'Y')
            cylinder(f'chest{s}.glass{j}',(xx,-.27,.12),.046,.013,GLASS,c,'Y')
            cylinder(f'chest{s}.led{j}',(xx,-.28,.12),.021,.01,WHITE,c,'Y')
        box(f'chest{s}.grille',(-s*.24,-.213,.075),(.32,.04,.2),BLACK,c,.015)
        for j in range(4):box(f'chest{s}.grille_bar{j}',(-s*.24,-.244,-.005+j*.048),(.32,.014,.012),STEEL,c,.003)
        box(f'chest{s}.lower_intake',(0,-.213,-.21),(.57,.036,.11),BLACK,c,.015)
        for j in range(6):box(f'chest{s}.intake_fin{j}',(-.24+j*.095,-.24,-.21),(.014,.017,.085),DARK,c,.002)
        cylinder(f'chest{s}.fog',(s*.37,-.22,-.17),.064,.04,DARK,c,'Y')
        box(f'chest{s}.lower_lip',(0,-.235,-.265),(.83,.075,.04),YELLOW,c,.012)
        for j in range(3):bolt(f'chest{s}.seam{j}',(-s*.44,-.208,-.12+j*.13),c,.015)
    # Golden bowtie at the center, kept on an independent clasp.
    c=assembly('sternum',(0,-.51,4.57),(0,-2.08,1.1),delay=.3)
    plate('sternum.bowtie',[(-.12,.033),(-.042,.033),(-.025,.065),(.08,.065),(.06,.033),(.13,.033),(.12,-.034),(.035,-.034),(.02,-.061),(-.08,-.061),(-.065,-.034),(-.13,-.034)],.026,CHROME,c)
    # Compact but detailed face, circular blue optics, segmented cheek machinery.
    h=assembly('head',(0,-.03,5.3),(0,-.35,.79),delay=.46)
    ellipsoid('head.inner_skull',(0,.015,.05),(.35,.28,.45),DARK,h)
    for s in (-1,1):
        plate(f'head{s}.helmet',[(-.16,-.08),(-.23,.17),(-.18,.4),(-.05,.5),(.12,.43),(.16,.11),(.12,-.05)],.24,YELLOW,h,(s*.2,.055,.06),rot=(0,s*-.18,0))
        box(f'head{s}.black_helmet_stripe',(s*.14,-.08,.43),(.09,.21,.035),BLACK,h,.014,rot=(0,s*.28,0))
        plate(f'head{s}.brow',[(-.17,.04),(.16,.08),(.16,-.01),(-.12,-.04)],.08,YELLOW,h,(s*.19,-.258,.17),rot=(0,s*-.14,0))
        o=torus(f'head{s}.optic_socket',(s*.16,-.274,.072),.079,.021,DARK,h);o.scale.z=.7
        o=cylinder(f'head{s}.optic_lens',(s*.16,-.298,.072),.065,.03,GLASS,h,'Y');o.scale.y=.65
        o=torus(f'head{s}.iris',(s*.16,-.322,.072),.045,.009,BLUE,h);o.scale.z=.6
        cylinder(f'head{s}.pupil',(s*.16,-.337,.072),.021,.018,DARK,h,'Y')
        ellipsoid(f'head{s}.cheek',(s*.24,-.21,-.14),(.09,.07,.15),CHROME,h)
        cylinder(f'head{s}.jaw_pivot',(s*.28,-.25,-.17),.057,.035,DARK,h,'Y')
        for j in range(3):rod(f'head{s}.jaw_link{j}',(s*(.11+j*.037),-.25,-.23),(s*(.17+j*.032),-.29,-.07),.014,CHROME,h)
        cylinder(f'head{s}.ear',(s*.35,.03,.02),.13,.07,STEEL,h,'X')
        plate(f'head{s}.ear_guard',[(-.065,-.18),(.055,-.17),(.06,.16),(-.06,.23)],.045,YELLOW,h,(s*.365,-.04,.04))
    plate('head.nose',[(-.07,.03),(.07,.03),(.09,-.1),(0,-.17),(-.09,-.1)],.10,STEEL,h,(0,-.29,-.07))
    plate('head.chin',[(-.12,.04),(.12,.04),(.09,-.11),(0,-.15),(-.09,-.11)],.07,CHROME,h,(0,-.22,-.28))
    plate('head.forehead',[(-.11,.19),(-.09,.45),(.09,.45),(.11,.19),(0,.1)],.08,YELLOW,h,(0,-.18,.05))
    box('head.crown_stripe',(0,-.226,.39),(.065,.012,.19),BLACK,h,.012)
    # Face mask stays attached, slides and pivots down for battle close-up.
    m=assembly('battle_mask',(0,-.37,5.12),(0,-.35,.79),rr=(0,0,0),delay=.47)
    plate('mask.shell',[(-.25,.1),(-.15,.2),(0,.1),(.15,.2),(.25,.1),(.2,-.19),(0,-.27),(-.2,-.19)],.065,YELLOW,m)
    for j in range(5):box('mask.vent'+str(j),(-.1+j*.05,-.045,-.08),(.019,.021,.14),DARK,m,.005)
    # Limbs: shoulder armor, upper linkages, forearm rails, articulated fingers.
    for s in (-1,1):
        shoulder=assembly(f'shoulder.{s}',(s*1.19,.03,4.56),(s*.84,-1.25,.83),rr=(0,s*.16,s*-.14),cr=(math.pi/2,0,0),delay=.35)
        ellipsoid(f'shoulder{s}.ball',(0,0,0),(.32,.28,.31),DARK,shoulder)
        cylinder(f'shoulder{s}.joint',(0,-.24,0),.19,.16,STEEL,shoulder,'Y')
        plate(f'shoulder{s}.fender',[(-.37,-.13),(-.4,.26),(-.21,.4),(.28,.31),(.43,.04),(.3,-.17)],.23,YELLOW,shoulder,(0,-.01,.2))
        plate(f'shoulder{s}.dark_inlay',[(-.27,.13),(.2,.13),(.27,.02),(-.18,-.02)],.025,BLACK,shoulder,(0,-.145,.3))
        w=assembly(f'front_wheel.{s}',(s*1.34,.19,4.34),(s*1.015,-1.44,.43),rr=(0,0,s*.08),delay=.38)
        wheel(f'wheel.front{s}',w);arch(f'wheel.front{s}.arch',w);w.scale=(.82,.82,.82)
        outline=[(-.72,-.02),(-.72,.58),(-.42,.79),(.4,.79),(.72,.57),(.72,-.02),(.51,0)]
        outline += [(.51*math.cos(j*math.pi/16),.51*math.sin(j*math.pi/16)) for j in range(1,17)]
        plate(f'wheel.front{s}.quarter_panel',outline,.065,YELLOW,w,(s*.17,0,0),rot=(0,0,math.pi/2),bevel=.018)
        u=assembly(f'upper_arm.{s}',(s*1.38,.015,3.91),(s*.65,-.6,.62),rr=(0,s*.04,s*.13),cr=(math.pi/2,0,0),delay=.3)
        cylinder(f'upper{s}.elbow',(0,0,-.33),.18,.38,STEEL,u,'Y')
        box(f'upper{s}.core',(0,0,0),(.27,.29,.57),DARK,u,.04)
        for j in (-1,1):rod(f'upper{s}.piston{j}',(j*.13,-.18,-.23),(j*.13,-.18,.24),.045,CHROME,u)
        for j in range(4):box(f'upper{s}.rib{j}',(0,-.19,-.18+j*.12),(.33,.04,.035),STEEL,u,.007)
        plate(f'upper{s}.outer_shell',[(-.12,.28),(.17,.24),(.22,-.17),(.03,-.3),(-.14,-.16)],.07,STEEL,u,(s*.08,-.24,0))
        fore=assembly(f'forearm.{s}',(s*1.52,-.08,3.25),(s*.57,.12,.63),rr=(.08,0,s*.06),cr=(math.pi/2,0,0),delay=.27)
        box(f'fore{s}.core',(0,0,0),(.32,.34,.71),DARK,fore,.06)
        plate(f'fore{s}.gauntlet',[(-.27,.38),(-.12,.48),(.23,.38),(.29,-.21),(.13,-.4),(-.22,-.3)],.16,YELLOW,fore,(0,-.22,0))
        plate(f'fore{s}.inlay',[(-.09,.31),(.07,.34),(.14,-.19),(-.02,-.28)],.023,BLACK,fore,(0,-.315,0))
        for j in (-1,1):
            rod(f'fore{s}.chrome_rail{j}',(j*.19,-.12,-.3),(j*.19,-.12,.29),.036,CHROME,fore)
            for k in range(3):bolt(f'fore{s}.bolt{j}.{k}',(j*.21,-.315,-.21+k*.21),fore,.026)
        hand=assembly(f'hand.{s}',(s*1.55,-.1,2.68),(s*.39,.63,.68),rr=(0,0,s*.08),cr=(math.pi/2,0,0),delay=.22)
        box(f'hand{s}.palm',(0,0,0),(.32,.24,.33),STEEL,hand,.045)
        for j in range(4):
            x=-.12+j*.081
            for k in range(3):
                box(f'hand{s}.finger{j}.{k}',(x,-.015-k*.035,-.22-k*.105),(.061,.105,.096),DARK,hand,.018,rot=(.16*k,0,0))
                cylinder(f'hand{s}.knuckle{j}.{k}',(x,-.075-k*.025,-.18-k*.105),.033,.068,CHROME,hand,'X',16)
        for k in range(2):box(f'hand{s}.thumb{k}',(-s*.21,-.08,-.04-k*.11),(.1,.11,.14),STEEL,hand,.025,rot=(0,-s*.4,0))
        # door wings with a real window opening, metal frame and dark glazing
        wing=assembly(f'door.{s}',(s*1.12,.53,4.58),(s*.99,.06,1.01),rr=(.14,-s*.25,-s*.95),cr=(0,0,0),delay=.31)
        # In car pose X thickness, Y length; robot uses same side door geometry.
        plate(f'door{s}.skin',[(-.5,-.32),(.5,-.32),(.5,.22),(.29,.38),(-.38,.36),(-.53,.15)],.085,YELLOW,wing,rot=(0,0,math.pi/2))
        plate(f'door{s}.glass',[(-.39,.37),(.28,.39),(.19,.77),(-.22,.78)],.04,GLASS,wing,rot=(0,0,math.pi/2))
        for a,b in [((0,-.39,.37),(0,-.22,.8)),((0,-.22,.8),(0,.2,.79)),((0,.2,.79),(0,.3,.39))]:rod(f'door{s}.window_frame{a}',a,b,.025,YELLOW,wing)
        box(f'door{s}.handle',(s*.06,.21,.24),(.035,.17,.035),CHROME,wing,.01)
        box(f'door{s}.mirror',(s*.14,-.45,.37),(.24,.22,.12),YELLOW,wing,.055)
        # Thighs, knee gear stack, shin shell and calf-mounted rear wheels
        thigh=assembly(f'thigh.{s}',(s*.53,.03,2.4),(s*.4,.65,.62),rr=(0,s*.09,s*-.11),cr=(math.pi/2,0,0),delay=.09)
        cylinder(f'thigh{s}.hip',(0,0,.35),.23,.43,DARK,thigh,'Y')
        box(f'thigh{s}.inner',(0,0,0),(.38,.4,.65),DARK,thigh,.08)
        for j in (-1,1):
            rod(f'thigh{s}.piston{j}',(j*.16,-.2,-.28),(j*.16,-.2,.25),.055,CHROME,thigh)
            rod(f'thigh{s}.housing{j}',(j*.16,-.2,-.26),(j*.16,-.2,.04),.078,STEEL,thigh)
        for j in range(6):
            box(f'thigh{s}.side_lamella{j}',(s*.25,.02,-.23+j*.09),(.06,.3,.042),STEEL,thigh,.01)
        plate(f'thigh{s}.guard',[(-.23,.27),(.24,.23),(.27,-.05),(.09,-.31),(-.19,-.25)],.12,YELLOW,thigh,(s*.13,-.25,0))
        knee=assembly(f'knee.{s}',(s*.65,-.01,1.94),(s*.43,1.15,.65),delay=.07)
        cylinder(f'knee{s}.gear',(0,0,0),.24,.4,DARK,knee,'X')
        plate(f'knee{s}.plate',[(-.19,.17),(.17,.21),(.25,.01),(.06,-.17),(-.21,-.1)],.16,CHROME,knee,(0,-.25,0))
        shin=assembly(f'shin.{s}',(s*.71,.07,1.19),(s*.71,1.54,.96),rr=(.04,0,s*-.06),cr=(math.pi/2,0,0),delay=.02)
        box(f'shin{s}.core',(0,0,0),(.38,.4,1.11),DARK,shin,.055)
        plate(f'shin{s}.armor',[(-.32,.62),(-.11,.72),(.28,.51),(.31,-.45),(.09,-.63),(-.29,-.49)],.23,YELLOW,shin,(0,-.25,.0))
        plate(f'shin{s}.black_panel',[(-.12,.52),(.02,.57),(.13,-.4),(-.035,-.48)],.03,BLACK,shin,(0,-.385,0))
        for j in (-1,1):rod(f'shin{s}.rail{j}',(j*.23,-.1,-.45),(j*.23,-.1,.45),.044,CHROME,shin)
        for j in range(8):box(f'shin{s}.vent{j}',(s*.22,-.39,-.27+j*.075),(.13,.027,.025),STEEL,shin,.006)
        w=assembly(f'rear_wheel.{s}',(s*.94,.17,1.2),(s*1.015,1.42,.43),delay=.02)
        wheel(f'wheel.rear{s}',w);arch(f'wheel.rear{s}.arch',w);w.scale=(.82,.82,.82)
        foot=assembly(f'foot.{s}',(s*.74,-.14,.33),(s*.53,1.84,.67),rr=(0,0,-s*.1),delay=0)
        box(f'foot{s}.sole',(0,-.12,-.14),(.64,.99,.17),RUBBER,foot,.07)
        plate(f'foot{s}.toe',[(-.32,-.1),(-.32,.11),(-.19,.23),(.21,.23),(.34,.02),(.3,-.15)],.5,YELLOW,foot,(0,-.4,-.02))
        box(f'foot{s}.toe_cap',(0,-.665,-.035),(.43,.08,.2),STEEL,foot,.04)
        cylinder(f'foot{s}.ankle',(0,.05,.15),.19,.41,STEEL,foot,'X')
        for j in range(3):box(f'foot{s}.metatarsal{j}',(-.16+j*.16,-.17,.135),(.08,.34,.075),DARK,foot,.012)
    # Roof / rear deck / windscreen; these travel to the robot backpack.
    roof=assembly('roof',(0,.65,4.02),(0,.27,1.73),rr=(math.pi/2,0,0),delay=.18)
    box('roof.enamel',(0,0,0),(1.58,1.12,.09),YELLOW,roof,.12)
    for s in (-1,1):box(f'roof.stripe{s}',(s*.3,0,.052),(.22,1.11,.013),BLACK,roof,.003)
    wind=assembly('windscreen',(0,.63,3.55),(0,-.64,1.44),rr=(.15,0,0),cr=(.68,0,0),delay=.19)
    box('windscreen.glass',(0,0,0),(1.59,.055,.63),GLASS,wind,.08)
    for s in (-1,1):rod(f'windscreen.pillar{s}',(s*.82,0,-.31),(s*.72,0,.31),.045,YELLOW,wind)
    back=assembly('rear_deck',(0,.73,3.02),(0,1.4,1.2),rr=(math.pi/2,0,0),delay=.12)
    box('rear_deck.enamel',(0,0,0),(1.72,1.0,.12),YELLOW,back,.1)
    for s in (-1,1):box(f'rear_deck.stripe{s}',(s*.3,0,.068),(.22,.98,.014),BLACK,back,.002)
    bumper=assembly('rear_bumper',(0,.64,2.64),(0,2.02,.89),rr=(.1,0,0),delay=.05)
    box('rear_bumper.enamel',(0,0,0),(1.83,.22,.47),YELLOW,bumper,.09)
    box('rear_bumper.diffuser',(0,.14,-.14),(1.5,.09,.13),DARK,bumper,.025)
    for s in (-1,1):
        for j in range(2):box(f'rear_bumper.tail{s}.{j}',(s*(.55+j*.18),.13,.11),(.14,.03,.12),AMBER,bumper,.02)
        cylinder(f'rear_bumper.exhaust{s}',(s*.66,.18,-.17),.077,.2,CHROME,bumper,'Y')
    # Four independent hood/quarter fillers become layered side waist armor.
    for s in (-1,1):
        for j in range(2):
            q=assembly(f'quarter.{s}.{j}',(s*(.51+j*.11),.21,3.22-j*.31),(s*.86,(-.99 if j==0 else 1.1),1.03),rr=(.15,s*.25,s*.12),delay=.14)
            box(f'quarter{s}.{j}.shell',(0,0,0),(.29,.85,.2),YELLOW,q,.09)
    rear_glass=assembly('rear_window',(0,.83,3.72),(0,1.06,1.47),rr=(.05,0,0),cr=(-.85,0,0),delay=.17)
    box('rear_window.glass',(0,0,0),(1.48,.05,.52),GLASS,rear_glass,.065)
    for s in (-1,1):
        rail=assembly(f'sill.{s}',(s*.49,.54,3.75),(s*.92,.15,.55),rr=(0,math.pi/2,0),delay=.15)
        box(f'sill{s}.enamel',(0,0,0),(.18,2.63,.19),YELLOW,rail,.055)
        shell=assembly(f'car_flank.{s}',(s*.39,.6,4.25),(s*.97,.25,.85),rr=(0,math.pi/2,0),delay=.18)
        box(f'car_flank{s}.shell',(0,0,0),(.09,1.48,.37),YELLOW,shell,.065)
    return ASSEMBLIES

def ease(x):
    x=max(0,min(1,x));return x*x*(3-2*x)

def pose(t,manual=None):
    raw=(t-3.1)/6.4 if manual is None else manual
    for a in ASSEMBLIES:
        q=ease((raw-a['delay']*.55)/(1-a['delay']*.55))
        o=a['object'];o.location=Vector(a['car']).lerp(Vector(a['robot']),q)
        # extra clearance opens outward, then settles in the endpoint
        if any(a['id'].startswith(x) for x in ['door.','chest.','front_wheel.','forearm.']):
            s=-1 if a['robot'][0]<0 else 1;o.location.x+=s*.32*math.sin(math.pi*q)
        o.rotation_euler=Euler(tuple(a['cr'][j]*(1-q)+a['rr'][j]*q for j in range(3)),'XYZ')
        if raw>=1:
            o.location.z+=.012*math.sin((t-9.5)*1.2)*(1 if a['id'] in ('head','torso','battle_mask') else .25)
    # Retract face mask below chin for first close-up; return to battle position.
    m=next(a['object'] for a in ASSEMBLIES if a['id']=='battle_mask')
    if raw>=1:
        opening=1-ease((t-11.2)/1.3);m.location.z-=.35*opening;m.location.y+=.12*opening
        m.rotation_euler.x=.25*opening
    h=next(a['object'] for a in ASSEMBLIES if a['id']=='head')
    if raw>=1:h.rotation_euler.z=.08*math.sin((t-9.5)*.65)

def track(camera,target):camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()

def camera_at(t):
    c=bpy.context.scene.camera
    if t<3.1:
        u=t/3.1;c.location=(5.3-u*.45,-7.7+u*.3,2.45-u*.2);target=(0,-.2,.8);lens=48
    elif t<10:
        u=ease((t-3.1)/6.9);c.location=Vector((5,-7.5,2.25)).lerp(Vector((8.7,-18.8,4.4)),u);target=Vector((0,0,.8)).lerp(Vector((0,0,2.9)),u);lens=47
    elif t<13.5:
        u=(t-10)/3.5;c.location=(1.75-u*.5,-6.4+u*.3,5.5-u*.13);target=(0,-.12,5.04);lens=55
    elif t<16:
        u=(t-13.5)/2.5;c.location=(3.8-u*.5,-5.2,3.25+u*.25);target=(1.02,-.05,3.44);lens=58
    else:
        u=(t-16)/6;angle=.32-u*.6;radius=20.8-u*.8
        c.location=(math.sin(angle)*radius,-math.cos(angle)*radius,3.25+u*.3);target=(0,0,2.96);lens=45
    c.data.lens=lens;track(c,target);c.data.dof.focus_distance=(Vector(target)-c.location).length

def area(name,loc,target,power,color,size,shape='DISK',size_y=None):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape=shape;d.size=size
    if size_y is not None:d.size_y=size_y
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;track(o,target);return o

def environment():
    box('stage.wet_floor',(0,0,-.115),(200,200,.2),GROUND,bevel=.01)
    # reflected seams and industrial light sources provide scale, no flat backdrop.
    wallmat=material('Charcoal concrete',(.035,.045,.05),.12,.8)
    for j in range(-5,6):
        box(f'architecture.pier{j}',(j*3.7,7,4),(.55,1.3,8),wallmat,bevel=.04)
        box(f'architecture.golden_slit{j}',(j*3.7+.35,6.3,3.5),(.035,.025,5.7),AMBER,bevel=.005)
    box('architecture.backwall',(0,8,4),(55,.6,8),wallmat,bevel=.02)
    for j in range(-6,7):box(f'floor.seam{j}',(j*2.5,0,-.009),(.015,60,.006),DARK,bevel=0)
    for j in range(100):
        x,y=RNG.uniform(-14,14),RNG.uniform(-10,9)
        if x*x+y*y<6:continue
        o=box(f'ground.debris{j}',(x,y,.015),(RNG.uniform(.03,.12),RNG.uniform(.04,.18),RNG.uniform(.025,.08)),DARK,bevel=.01)
        o.rotation_euler.z=RNG.uniform(0,6)
    area('key.warm_softbox',(1.5,-5.5,9),(0,0,3),1300,(1,.83,.58),6)
    area('fill.cool_softbox',(-5,-1,5),(0,0,3),950,(.32,.64,1),5)
    area('rim.sunset',(3,5,7),(0,0,3),1800,(1,.43,.12),4)
    area('rim.blue',(-3,4,5),(0,0,3),1000,(.28,.56,1),3)
    area('front.long_card',(0,-7,3.8),(0,0,3.4),300,(.75,.86,1),5,'RECTANGLE',2)
    w=bpy.context.scene.world;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.12,.17,.24,1);w.node_tree.nodes['Background'].inputs[1].default_value=.3

def initialize(engine='CYCLES',samples=24,width=1920):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    setup_materials();model();environment()
    s=bpy.context.scene;s.render.engine=engine
    if engine=='CYCLES':
        s.cycles.samples=samples;s.cycles.use_denoising=True;s.cycles.max_bounces=5
        s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.13;s.cycles.adaptive_min_samples=4
        try:
            prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
            for d in prefs.devices:d.use=d.type=='METAL'
            if any(d.type=='METAL' for d in prefs.devices):s.cycles.device='GPU'
        except Exception:pass
    else:
        s.eevee.taa_render_samples=samples
    s.render.resolution_x=width;s.render.resolution_y=round(width*804/1920/2)*2;s.render.resolution_percentage=100
    s.render.image_settings.file_format='PNG';s.render.fps=FPS;s.frame_start=1;s.frame_end=FPS*DURATION
    s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=-.2
    bpy.ops.object.camera_add();c=bpy.context.object;c.name='camera.cinematic';s.camera=c
    c.data.sensor_width=36;c.data.dof.use_dof=True;c.data.dof.aperture_fstop=7.1
    s.render.film_transparent=False
    s.render.use_persistent_data=True
    s.use_nodes=True;n=s.node_tree.nodes;n.clear();r=n.new('CompositorNodeRLayers');g=n.new('CompositorNodeGlare');g.glare_type='FOG_GLOW';g.quality='HIGH';g.threshold=2;g.mix=-.94
    out=n.new('CompositorNodeComposite');s.node_tree.links.new(r.outputs['Image'],g.inputs[0]);s.node_tree.links.new(g.outputs[0],out.inputs[0])
    return s

def write_catalog():
    catalog={'rootId':'scene','assemblies':[{'id':a['id'],'parent':'scene','robot':a['robot'],'car':a['car'],'robot_rotation':a['rr'],'car_rotation':a['cr'],'delay':a['delay'],'evidence':'inferred / designed','parts':[p['id'] for p in PARTS if p['assembly']==a['id']]} for a in ASSEMBLIES], 'parts':PARTS}
    (BASE/'records/assembly-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
    return catalog

def validate():
    names=[p['id'] for p in PARTS];assert len(names)==len(set(names)),'duplicate part IDs'
    counts=[];scales={o.name:tuple(o.scale) for o in bpy.data.objects if o.type=='MESH'}
    snapshots=[]
    for t in [0,3.1,4.7,6.3,7.9,9.5,12,18,6.3]:
        pose(t);bpy.context.view_layer.update()
        snap={a['id']:[round(v,6) for row in a['object'].matrix_world for v in row] for a in ASSEMBLIES};snapshots.append(snap)
        assert all(math.isfinite(v) for m in snap.values() for v in m)
        assert all(tuple(bpy.data.objects[n].scale)==sc for n,sc in scales.items())
        counts.append(sum(o.type=='MESH' and not o.hide_render for o in bpy.data.objects))
    assert snapshots[3]==snapshots[-1],'pose is not reentrant'
    assert len(set(counts))==1,'mesh identity changed'
    result={'assemblies':len(ASSEMBLIES),'visual_parts':len(PARTS),'mesh_count':counts[0],'reentrant_pose':True,'fixed_scale':True,'fixed_visible_mesh_count':True,'collision_checked':False,'film_matched_measurement':False}
    (OUT/'model-check.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));return result

def main():
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    p=argparse.ArgumentParser();p.add_argument('--mode',choices=['preflight','render','build','check'],default='preflight');p.add_argument('--engine',default='CYCLES');p.add_argument('--samples',type=int,default=24);p.add_argument('--width',type=int,default=1920);p.add_argument('--start',type=int,default=0);p.add_argument('--end',type=int,default=528);p.add_argument('--times',default='1,6.3,10.6,18')
    a=p.parse_args(argv);s=initialize(a.engine,a.samples,a.width);write_catalog();validate()
    fingerprint=hashlib.sha256(Path(__file__).read_bytes()+json.dumps({'engine':a.engine,'samples':a.samples,'width':a.width}).encode()).hexdigest()
    if a.mode=='preflight':
        for t in map(float,a.times.split(',')):
            pose(t);camera_at(t);s.render.filepath=str(OUT/f'preflight-{t:04.1f}.png');bpy.ops.render.render(write_still=True)
    elif a.mode=='render':
        frames=OUT/'frames'/fingerprint[:12];frames.mkdir(parents=True,exist_ok=True)
        (OUT/'render-config.json').write_text(json.dumps({'fingerprint':fingerprint,'frames':str(frames.relative_to(BASE)),'width':s.render.resolution_x,'height':s.render.resolution_y,'fps':FPS,'duration':DURATION,'count':FPS*DURATION,'engine':a.engine,'samples':a.samples},indent=2)+'\n')
        for i in range(a.start,min(a.end,FPS*DURATION)):
            dest=frames/f'{i:05d}.png'
            if dest.exists():continue
            t=i/FPS;s.frame_set(i+1);pose(t);camera_at(t);s.render.filepath=str(dest);bpy.ops.render.render(write_still=True)
            (OUT/'progress.json').write_text(json.dumps({'frame':i,'total':FPS*DURATION,'fingerprint':fingerprint}))
    elif a.mode=='build':
        pose(18);camera_at(18);bpy.ops.object.select_all(action='DESELECT')
        for a1 in ASSEMBLIES:
            o=a1['object'];o.select_set(True)
            for child in o.children:child.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUT/'bumblebee.glb'),use_selection=True,export_format='GLB',export_animations=False,export_materials='EXPORT',export_apply=True,export_yup=False)
        for i in range(FPS*DURATION):
            t=i/FPS;pose(t);camera_at(t)
            for a1 in ASSEMBLIES:
                o=a1['object'];o.keyframe_insert('location',frame=i+1);o.keyframe_insert('rotation_euler',frame=i+1)
            c=s.camera;c.keyframe_insert('location',frame=i+1);c.keyframe_insert('rotation_euler',frame=i+1);c.data.keyframe_insert('lens',frame=i+1);c.data.dof.keyframe_insert('focus_distance',frame=i+1)
        s.frame_set(433);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bumblebee.blend'))
    print('BUMBLEBEE_COMPLETE',a.mode,flush=True)

if __name__=='__main__':main()
