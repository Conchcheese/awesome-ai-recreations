import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import struct
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
from check_transformer_contract import safe_path, validate, validate_graph, validate_timeline, validate_references
SERIES = ROOT/'series/变形金刚系列'
spec = importlib.util.spec_from_file_location('new_character', SERIES/'tools/new_character.py')
scaffold = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scaffold)


class TransformerWorkflowTests(unittest.TestCase):
    def test_showcase_movie_revision_uses_public_record_without_local_render_logs(self):
        module_spec=importlib.util.spec_from_file_location('showcase_inputs',SERIES/'01-擎天柱-电影版/tools/showcase_inputs.py')
        module=importlib.util.module_from_spec(module_spec);module_spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'records').mkdir();film=root/'download.mp4';film.write_bytes(b'published render')
            record={'film':{'videoSha256':hashlib.sha256(film.read_bytes()).hexdigest(),'renderHtmlSha256':'a'*64}}
            (root/'records/验证摘要.json').write_text(json.dumps(record))
            self.assertEqual('a'*64,module.film_revision(root,film)['renderHtmlSha256'])
            self.assertFalse((root/'artifacts/cycles-render.json').exists())
            film.write_bytes(b'changed render')
            with self.assertRaises(ValueError):module.film_revision(root,film)
    def graph(self):
        return {'assemblies': [{'id': 'body', 'parent': 'scene', 'parts': ['bolt']}, {'id': 'head', 'parent': 'body', 'parts': []}], 'parts': [{'id': 'bolt', 'assembly': 'body'}]}

    def timeline(self):
        return {'sourceDuration': 50, 'fps': 24, 'transform': [8, 19], 'movieDuration': 9,
                'edit': [{'in': 0, 'out': 2, 'sourceIn': 0, 'sourceOut': 2, 'purpose': 'establish'}, {'in': 2, 'out': 9, 'sourceIn': 8, 'sourceOut': 19, 'purpose': 'transformation'}]}

    def test_current_case_contract(self):
        path = SERIES/'01-擎天柱-电影版/production.json'
        self.assertEqual([], validate(json.loads(path.read_text()), path.parent, require_ready=True))

    def test_graph_rejects_cycles_missing_parents_duplicate_and_wrong_ownership(self):
        self.assertEqual([], validate_graph(self.graph(), 'scene', {'head': 'head'}))
        for mutate, word in [
            (lambda g: g['assemblies'][0].update(parent='head'), '环'),
            (lambda g: g['assemblies'][1].update(parent='absent'), '未知父'),
            (lambda g: g['assemblies'].append(copy.deepcopy(g['assemblies'][0])), 'ID 重复'),
            (lambda g: g['parts'][0].update(assembly='head'), '归属'),
            (lambda g: g['assemblies'][1]['parts'].append('bolt'), '多个装配'),
        ]:
            with self.subTest(word=word):
                g = self.graph(); mutate(g)
                self.assertTrue(any(word in e for e in validate_graph(g, 'scene', {})))
        self.assertTrue(validate_graph(self.graph(), 'scene', {'focus': 'absent'}))

    def test_edit_keeps_full_transform_and_rejects_gaps_fractional_frames_nan(self):
        self.assertEqual([], validate_timeline(self.timeline()))
        for change in [lambda t: t['edit'][1].update(sourceIn=9), lambda t: t['edit'][1].update(**{'in': 2.1}), lambda t: t['edit'][1].update(sourceOut=float('nan')), lambda t: t.update(movieDuration=12)]:
            t = self.timeline(); change(t)
            self.assertTrue(validate_timeline(t))

    def test_path_boundary_rejects_traversal_and_symlink_escape(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)/'case'; base.mkdir()
            (base/'link').symlink_to(Path(d), target_is_directory=True)
            for p in ['../x', '/tmp/x', 'C:/x', 'link/x']:
                with self.subTest(path=p), self.assertRaises(ValueError):
                    safe_path(base, p)

    def test_reference_gate_checks_original_media_hash_and_source(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d); (base/'reference.jpg').write_bytes(b'reference fixture')
            ref = {'sources': [{'file': 'reference.jpg', 'url': 'https://example.com/original', 'sha256': hashlib.sha256(b'reference fixture').hexdigest()}]}
            self.assertEqual([], validate_references(ref, base))
            (base/'reference.jpg').write_bytes(b'changed')
            self.assertTrue(validate_references(ref, base))
            ref['sources'][0]['url'] = 'file:///private/path'
            self.assertTrue(any('URL' in e for e in validate_references(ref, base)))
            self.assertTrue(validate_references({'sources': []}, base))

    def test_scaffold_is_draft_dry_run_has_no_side_effects_and_wont_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)/'drafts'
            target = scaffold.create('test-character', '测试', '某一具体年份', base, dry_run=True)
            self.assertFalse(base.exists())
            self.assertEqual(target, scaffold.create('test-character', '测试', '某一具体年份', base))
            data = json.loads((target/'production.json').read_text())
            self.assertEqual([], validate(data, target))
            self.assertTrue(validate(data, target, require_ready=True))
            self.assertIn('throw new Error', (target/'src/character.mjs').read_text())
            with self.assertRaises(FileExistsError):
                scaffold.create('test-character', '覆盖', '版本', base)
            self.assertEqual('测试', json.loads((target/'production.json').read_text())['character']['title'])
            for slug in ['../oops', '/tmp/oops', 'A', 'a--b', 'a/b']:
                with self.subTest(slug=slug), self.assertRaises(ValueError):
                    scaffold.create(slug, '角色', '版本', base)


class GLBDigestTests(unittest.TestCase):
    def write_glb(self, target, prefix=0, x=1.0, compressed=False):
        binary=b'\0'*prefix+struct.pack('<fff',x,2.0,3.0)
        data={'asset':{'version':'2.0'},'buffers':[{'byteLength':len(binary)}], 'bufferViews':[{'buffer':0,'byteOffset':prefix,'byteLength':12}], 'accessors':[{'bufferView':0,'componentType':5126,'count':1,'type':'VEC3'}], 'meshes':[{'primitives':[{'attributes':{'POSITION':0}}]}]}
        if compressed:data['extensionsUsed']=['KHR_draco_mesh_compression']
        encoded=json.dumps(data).encode();encoded+=b' ' *((-len(encoded))%4)
        target.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(encoded)+8+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)

    def test_resolved_digest_ignores_placement_but_detects_geometry_change(self):
        spec=importlib.util.spec_from_file_location('glb_digest',SERIES/'01-擎天柱-电影版/tools/glb-digest.py')
        tool=importlib.util.module_from_spec(spec);spec.loader.exec_module(tool)
        with tempfile.TemporaryDirectory() as d:
            a,b,c=map(lambda n:Path(d)/n,['a.glb','b.glb','c.glb'])
            self.write_glb(a);self.write_glb(b,prefix=4);self.write_glb(c,x=4)
            da,db,dc=[tool.digest(p) for p in [a,b,c]]
            self.assertNotEqual(da['rawSha256'],db['rawSha256'])
            self.assertEqual(da['resolvedDataSha256'],db['resolvedDataSha256'])
            self.assertNotEqual(da['resolvedDataSha256'],dc['resolvedDataSha256'])
            self.write_glb(c,compressed=True)
            with self.assertRaises(ValueError):tool.digest(c)


if __name__ == '__main__':
    unittest.main()
