"""Import the exact web model/rig and render with physical lights and materials."""
import bpy,sys,json,math,time,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
GLB_SHA=hashlib.sha256((ROOT/'artifacts/optimus-cinematic.glb').read_bytes()).hexdigest()
META_SHA=hashlib.sha256((ROOT/'artifacts/animation-export.json').read_bytes()).hexdigest()
SCENE_SHA=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def option(name,default):return args[args.index(name)+1] if name in args else default
engine=option('--engine','CYCLES');frame=int(option('--frame','516'));width=int(option('--width','1600'));height=int(option('--height','900'));samples=int(option('--samples','48'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'artifacts/optimus-cinematic.glb'))
scene=bpy.context.scene;scene.render.fps=24;scene.frame_start=0;scene.frame_end=1200
# glTF action starts at Blender frame 1 by the importer; locate actual animation range.
actions=[a for a in bpy.data.actions if a.frame_range[1]>100]
start=1.0
if actions:start=min(float(a.frame_range[0]) for a in actions)
meta=json.loads((ROOT/'artifacts/animation-export.json').read_text())
frames=meta['cameraFrames']
def point(v):return Vector((v[0],-v[2],v[1]))
cam_data=bpy.data.cameras.new('CinemaCamera');camera=bpy.data.objects.new('CinemaCamera',cam_data);scene.collection.objects.link(camera);scene.camera=camera;cam_data.sensor_width=36;cam_data.clip_start=.05;cam_data.clip_end=250
focus_obj=bpy.data.objects.new('FocusTarget',None);scene.collection.objects.link(focus_obj);cam_data.dof.use_dof=True;cam_data.dof.focus_object=focus_obj;cam_data.dof.aperture_fstop=3.2;cam_data.dof.aperture_blades=9
for f in frames:
 fr=f['t']*24+start;camera.location=point(f['position']);target=point(f['target']);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();focus_obj.location=target
 # Source FOV is vertical; Blender lens/sensor are horizontal, use sensor fit vertical.
 cam_data.sensor_fit='VERTICAL';cam_data.sensor_height=24;cam_data.lens=24/(2*math.tan(math.radians(f['fov'])/2))
 camera.keyframe_insert('location',frame=fr);camera.keyframe_insert('rotation_euler',frame=fr);focus_obj.keyframe_insert('location',frame=fr);cam_data.keyframe_insert('lens',frame=fr)
# Linear per-frame samples preserve cuts; don't introduce Bezier overshoot.
for obj in [camera,focus_obj]:
 if obj.animation_data and obj.animation_data.action:
  for curve in obj.animation_data.action.fcurves:
   for key in curve.keyframe_points:key.interpolation='LINEAR'
# Material microstructure is added to existing PBR maps; no flat-color replacement.
for mat in bpy.data.materials:
 if not mat.use_nodes:continue
 p=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not p:continue
 if 'laminated' in mat.name:
  p.inputs['Transmission Weight'].default_value=.12;p.inputs['Roughness'].default_value=.18
 if 'clearcoat' in mat.name or 'enamel' in mat.name:
  p.inputs['Coat Weight'].default_value=.48;p.inputs['Coat Roughness'].default_value=.27
 if 'blue-optical' in mat.name:
  p.inputs['Emission Strength'].default_value=1.1
 if 'projector' in mat.name:
  for sec,val in [(0,1.5),(10.53,1.5),(14.6,.015),(50,.015)]:
   p.inputs['Emission Strength'].default_value=val;p.inputs['Emission Strength'].keyframe_insert('default_value',frame=sec*24+start)
 if 'energon' in mat.name:
  for sec,val in [(0,0),(30.2,0),(31,.85),(33,.85),(33.9,0),(50,0)]:
   p.inputs['Alpha'].default_value=val;p.inputs['Alpha'].keyframe_insert('default_value',frame=sec*24+start);p.inputs['Emission Strength'].default_value=val*.85;p.inputs['Emission Strength'].keyframe_insert('default_value',frame=sec*24+start)
 if 'reactor-lens' in mat.name:p.inputs['Emission Strength'].default_value=.25
 # Microscopic unevenness at material scale, independent from engraved model geometry.
 nodes=mat.node_tree.nodes;links=mat.node_tree.links
 if any(k in mat.name for k in ['steel','alloy','chrome','clearcoat','enamel','titanium']):
  noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=170;noise.inputs['Detail'].default_value=2.2;noise.inputs['Roughness'].default_value=.6
  painted=any(k in mat.name for k in ['clearcoat','enamel'])
  bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.07 if painted else .10;bump.inputs['Distance'].default_value=.00018 if painted else .00055;links.new(noise.outputs['Fac'],bump.inputs['Height'])
  previous=p.inputs['Normal'].links[0].from_socket if p.inputs['Normal'].links else None
  if previous:links.new(previous,bump.inputs['Normal'])
  links.new(bump.outputs['Normal'],p.inputs['Normal'])
# Physically sized architectural environment.
def material(name,color,rough=.6,metal=.0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
floor_mat=material('damp_concrete',(0.035,0.045,0.052),.58,.07)
n=floor_mat.node_tree.nodes;l=floor_mat.node_tree.links;p=n.get('Principled BSDF');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=19;noise.inputs['Detail'].default_value=4;noise.inputs['Roughness'].default_value=.72
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.016,.023,.029,1);ramp.color_ramp.elements[1].color=(.07,.08,.087,1);l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],p.inputs['Base Color'])
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.21;bump.inputs['Distance'].default_value=.028;l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
steel=material('structural_steel',(.022,.035,.045),.44,.72);wall=material('concrete_wall',(.07,.085,.10),.75,.08)
def cube(name,loc,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);bev=o.modifiers.new('small industrial bevel','BEVEL');bev.width=.025;bev.segments=2;return o
cube('floor',(0,0,-.12),(160,160,.24),floor_mat)
for side in [-1,1]:
 for i in range(7):
  y=-8+i*7
  cube('hangar_column',(side*14,y,7.5),(.65,.80,15),steel);cube('column_foot',(side*14,y,.25),(1.1,1.25,.5),wall);cube('cross_beam',(0,y,14.8),(28.5,.4,.35),steel)
  if i<6:cube('wall_bay',(side*14.35,y+3.5,4),(.35,6.3,8),wall)
# HDR environment supplies real high-frequency reflection variation.
cube('back_wall',(0,38,7.5),(28.5,.40,15),wall)
cube('hangar_roof',(0,14,15),(29,70,.30),steel)
for k in range(9):cube('back_roller_rib',(0,37.7,1.0+k*1.5),(25,.15,.07),steel)
world=bpy.data.worlds.new('industrial_sunset');world.use_nodes=True;scene.world=world;wn=world.node_tree.nodes;wl=world.node_tree.links;bg=wn.get('Background');bg.inputs['Strength'].default_value=.22
tex=wn.new('ShaderNodeTexEnvironment');tex.image=bpy.data.images.load(str(ROOT/'assets/industrial_sunset_02_2k.hdr'));mapping=wn.new('ShaderNodeMapping');coord=wn.new('ShaderNodeTexCoord');mapping.inputs['Rotation'].default_value[2]=2.5;wl.new(coord.outputs['Generated'],mapping.inputs['Vector']);wl.new(mapping.outputs['Vector'],tex.inputs['Vector']);wl.new(tex.outputs['Color'],bg.inputs['Color'])
def area(name,loc,target,energy,color,size,shape='DISK',size_y=None):
 d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.color=color;d.shape=shape;d.size=size
 if size_y and shape=='RECTANGLE':d.size_y=size_y
 o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
area('warm_soft_key',(-5,-8,11),(0,0,5),2400,(1.0,.83,.65),5)
area('cool_long_rim',(6,5,9),(0,0,5),3600,(.48,.69,1),3,'RECTANGLE',8)
area('frontal_silver_fill',(4,-10,6),(0,0,5),450,(.77,.87,1),5)
area('top_striplights',(0,0,14),(0,0,3),2000,(.9,.91,.88),8,'RECTANGLE',2)
# Practical fluorescent elements are visible geometry and have broad physical emitters.
for side in [-1,1]:
 for i in range(5):
  yy=-8+i*7
  lm=material(f'practical_{side}_{i}',(.9,.56,.24) if side<0 else(.45,.64,.85));pr=lm.node_tree.nodes.get('Principled BSDF');pr.inputs['Emission Color'].default_value=(1,.47,.14,1) if side<0 else(.35,.58,1,1);pr.inputs['Emission Strength'].default_value=3
  cube('practical_light',(side*13.58,yy,5.8),(.14,.14,2.8),lm)
  area('side_practical',(side*13.4,yy,5.7),(0,yy,4.5),120,(1,.55,.25) if side<0 else(.42,.64,1),2,'RECTANGLE',.3)
scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.0
try:bpy.ops.preferences.addon_enable(module='cycles')
except Exception as e:print('cycles addon',e)
compute_device='CPU'
if engine=='CYCLES':
 scene.render.engine='CYCLES';scene.cycles.samples=samples;scene.cycles.seed=6301;scene.cycles.use_animated_seed=False;scene.cycles.use_denoising=True;scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_min_samples=4;scene.cycles.adaptive_threshold=.08;scene.cycles.sample_clamp_indirect=3;scene.cycles.caustics_reflective=False;scene.cycles.caustics_refractive=False;
 scene.cycles.denoising_use_gpu=True;scene.render.use_persistent_data=True;scene.cycles.max_bounces=4;scene.cycles.diffuse_bounces=2;scene.cycles.glossy_bounces=3;scene.cycles.transmission_bounces=3
 try:
  prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
  gpu=False
  for d in prefs.devices:d.use=d.type=='METAL';gpu|=d.use
  if gpu:scene.cycles.device='GPU';compute_device='Metal'
  print('CYCLES_DEVICES',[(d.name,d.type,d.use) for d in prefs.devices])
 except Exception as e:print('Cycles GPU unavailable',e)
else:
 scene.render.engine='BLENDER_EEVEE_NEXT'
 if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=samples
 if hasattr(scene.eevee,'use_raytracing'):scene.eevee.use_raytracing=True
scene.frame_set(int(frame+start));scene.render.filepath=str(ROOT/'artifacts'/f'blender-{engine.lower()}-{frame:04}.png')
if '--save' in args:bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'artifacts/optimus-cinematic.blend'))
if '--movie' in args:
 import importlib.util,hashlib
 spec=importlib.util.spec_from_file_location('edit',ROOT/'tools/edit.py');edit=importlib.util.module_from_spec(spec);spec.loader.exec_module(edit)
 folder=ROOT/'artifacts/cycles-frames';folder.mkdir(exist_ok=True)
 config={'glbSha256':GLB_SHA,'exportMetaSha256':META_SHA,'htmlSha256':meta['htmlSha256'],'resolution':[width,height],'samples':samples,'sceneScriptSha256':SCENE_SHA,'edit':edit.CUTS,'environmentSha256':hashlib.sha256((ROOT/'assets/industrial_sunset_02_2k.hdr').read_bytes()).hexdigest(),'captionHashes':[hashlib.sha256((ROOT/'artifacts/captions'/f'{width}-{i:02d}.png').read_bytes()).hexdigest() for i in range(len(edit.CUTS))]}
 signature=json.dumps(config,sort_keys=True);cache=folder/'render-config.json'
 if any(folder.glob('*.png')):
  if not cache.exists() or json.dumps(json.loads(cache.read_text()),sort_keys=True)!=signature:raise RuntimeError('旧帧与当前资产/灯光/镜头不同，请先另存 cycles-frames 后重渲染')
 cache.write_text(json.dumps(config,indent=2))
 scene.use_nodes=True;nt=scene.node_tree;nt.nodes.clear();rl=nt.nodes.new('CompositorNodeRLayers');glare=nt.nodes.new('CompositorNodeGlare');glare.glare_type='FOG_GLOW';glare.quality='HIGH';glare.threshold=2.0;glare.size=6;glare.mix=-.93;nt.links.new(rl.outputs['Image'],glare.inputs['Image'])
 overlay=nt.nodes.new('CompositorNodeImage');over=nt.nodes.new('CompositorNodeAlphaOver');over.inputs[0].default_value=1;nt.links.new(glare.outputs['Image'],over.inputs[1]);nt.links.new(overlay.outputs['Image'],over.inputs[2]);comp=nt.nodes.new('CompositorNodeComposite');nt.links.new(over.outputs[0],comp.inputs[0]);caps=[bpy.data.images.load(str(ROOT/'artifacts/captions'/f'{width}-{i:02d}.png')) for i in range(len(edit.CUTS))]
 frame_start=int(option('--start','0'));frame_end=int(option('--end',str(edit.DURATION*edit.FPS)))
 if hasattr(scene.render,'use_motion_blur'):scene.render.use_motion_blur=True;scene.render.motion_blur_shutter=.30
 movie_started=time.time()
 for i in range(frame_start,frame_end):
  outfile=folder/f'{i:04d}.png'
  if outfile.exists() and outfile.stat().st_size>5000:continue
  mt=i/edit.FPS;st,index,name=edit.source_at(mt);fr=st*24+start;scene.frame_set(int(fr),subframe=fr-int(fr));overlay.image=caps[index]
  # Disable shutter on a hard cut; adjacent frames remain motion-blurred.
  cut_start=edit.CUTS[index][0]
  if hasattr(scene.render,'use_motion_blur'):scene.render.use_motion_blur=(mt-cut_start)>.06
  scene.render.filepath=str(outfile);bpy.ops.render.render(write_still=True)
  if i%12==0:
   report={'frame':i,'total':edit.DURATION*edit.FPS,'movieSeconds':mt,'sourceSeconds':st,'shot':name,'elapsedSeconds':time.time()-movie_started,'resolution':[width,height],'samples':samples,'engine':'CYCLES','startFrame':frame_start}
   (ROOT/'artifacts/render-progress.json').write_text(json.dumps(report,indent=2));print('MOVIE_PROGRESS',json.dumps(report),flush=True)
 assert GLB_SHA==hashlib.sha256((ROOT/'artifacts/optimus-cinematic.glb').read_bytes()).hexdigest(),'渲染期间GLB被改写'
 assert META_SHA==hashlib.sha256((ROOT/'artifacts/animation-export.json').read_bytes()).hexdigest(),'渲染期间镜头/导出数据被改写'
 assert SCENE_SHA==hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'渲染期间场景脚本被改写'
 report={'frames':edit.DURATION*edit.FPS,'fps':edit.FPS,'duration':edit.DURATION,'resolution':[width,height],'samples':samples,'engine':f'Blender 4.5.4 / Cycles / {compute_device} / OIDN','glbSha256':GLB_SHA,'exportMetaSha256':META_SHA,'htmlSha256':meta['htmlSha256'],'sourceDuration':50,'edit':edit.CUTS,'result':'complete'}
 (ROOT/'artifacts/cycles-render.json').write_text(json.dumps(report,indent=2));print('MOVIE_COMPLETE',flush=True)
elif '--no-render' not in args:
 requested=option('--frames',str(frame)).split(',')
 for fr in requested:
  fr=int(fr);scene.frame_set(int(fr+start));scene.render.filepath=str(ROOT/'artifacts'/f'blender-{engine.lower()}-{fr:04}.png')
  started=time.time();bpy.ops.render.render(write_still=True);print('RENDER_SECONDS',fr,time.time()-started,flush=True)
print('SCENE_READY',len(bpy.data.objects),scene.render.engine,scene.frame_current)
