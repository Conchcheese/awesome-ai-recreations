"""Run with Blender --background artifacts/bumblebee.blend --python tools/composition.py."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

BASE=Path(__file__).resolve().parents[1]
catalog=json.loads((BASE/'records/assembly-catalog.json').read_text())
pieces=[bpy.data.objects[p['id']] for p in catalog['parts']]
scene=bpy.context.scene;rows=[]
for t in [0,1,3,4.5,6.3,8.9,9.5,16,18,21.9]:
    scene.frame_set(round(t*24)+1);bpy.context.view_layer.update()
    pts=[];refined=[]
    for o in pieces:
        p=[world_to_camera_view(scene,scene.camera,o.matrix_world@Vector(v)) for v in o.bound_box]
        # A tire's empty bounding-box corners can extend beyond the silhouette.
        # Refine candidates using actual evaluated vertices, not a looser proxy.
        if any(v.x<0 or v.x>1 or v.y<0 or v.y>1 for v in p):
            e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=e.to_mesh()
            p=[world_to_camera_view(scene,scene.camera,e.matrix_world@v.co) for v in mesh.vertices];e.to_mesh_clear();refined.append(o.name)
        pts.extend(p)
    b=[min(p.x for p in pts),min(p.y for p in pts),max(p.x for p in pts),max(p.y for p in pts)]
    assert all(math.isfinite(v) for v in b)
    rows.append({'t':t,'bounds_xyxy':b,'whole_subject_in_frame':all(0<=v<=1 for v in b),'refined_meshes':refined})
assert all(r['whole_subject_in_frame'] for r in rows),json.dumps(rows)
(BASE/'artifacts/composition-check.json').write_text(json.dumps({'projected_mesh_bounds':rows,'purpose':'framing only, not an artistic score'},indent=2)+'\n')
print('Full-subject framing passed at',len(rows),'sampled vehicle / transformation / hero times.')
