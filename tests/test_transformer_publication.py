import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'));sys.path.insert(0,str(ROOT/'series/变形金刚系列/tools'))
from catalog import recreation_plan
from check_repo import validate_catalog
from check_transformer_contract import validate_references
import characters

class PublicationReferenceTests(unittest.TestCase):
 def fixture(self,root):
  for p in ['prompt.md','README.md','spec.md','record.md','check.py']:(root/p).write_text('fixture')
  (root/'src').mkdir();(root/'refs').mkdir()
  manifest={'references':[{'path':'refs/local/input.jpg','source_url':'https://example.com/original','kind':'original-frame','sha256':'0'*64}]}
  (root/'refs/inputs.json').write_text(json.dumps(manifest))
  case={'id':'example','title':'Example','aliases':[],'prompt':'prompt.md','recreation':{'references':['refs/local/input.jpg'],'reference_manifest':'refs/inputs.json','notes':'metadata only'},'variants':[{'id':'test','model_label':'test','provenance':'derived','visual_goal':'fidelity','readme':'README.md','live':'README.md','film':'README.md','source':'src','spec':'spec.md','record':'record.md','cwd':'.','references':['refs'],'commands':{'build':[['python3','check.py']],'check':[['python3','check.py']]},'build_outputs':['out.html'],'notes':'fixture'}]}
  return {'schema_version':1,'cases':[case]},manifest
 def test_fresh_clone_accepts_registered_remote_inputs_but_rejects_missing_unregistered(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);data,manifest=self.fixture(root);self.assertEqual([],validate_catalog(data,root));plan=recreation_plan(data['cases'][0]);self.assertIn('reference_manifest',plan)
   data['cases'][0]['recreation'].pop('reference_manifest');self.assertTrue(any('不存在' in e for e in validate_catalog(data,root)))
 def test_remote_manifest_rejects_insecure_or_mismatched_or_escaping_sources(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);data,manifest=self.fixture(root)
   for field,value in [('source_url','file:///private/x'),('path','../x.jpg'),('sha256','bad')]:
    m=copy.deepcopy(manifest);m['references'][0][field]=value;(root/'refs/inputs.json').write_text(json.dumps(m));self.assertTrue(validate_catalog(data,root))
 def test_metadata_only_does_not_hide_local_hash_drift_and_strict_gate_requires_media(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);refs={'mediaDistribution':'local-only','sources':[{'file':'local/image.jpg','url':'https://example.com/x','sha256':hashlib.sha256(b'original').hexdigest()}]}
   self.assertEqual([],validate_references(refs,root));self.assertTrue(validate_references(refs,root,True));(root/'local').mkdir();(root/'local/image.jpg').write_bytes(b'changed');self.assertTrue(validate_references(refs,root))

class CharacterLibraryTests(unittest.TestCase):
 def test_library_is_auditable_and_not_registered_as_finished_cases(self):
  self.assertEqual([],characters.validate_library());data=characters.load();self.assertGreaterEqual(len(data['characters']),60)
  finished={x['id'] for x in json.loads((ROOT/'catalog.json').read_text())['cases']};self.assertTrue(finished.isdisjoint(x['id'] for x in data['characters']))
 def test_name_resolution_and_ambiguous_name(self):
  data=characters.load();self.assertEqual('bumblebee-2007',characters.resolve('大黄蜂',data)['id']);data=copy.deepcopy(data);data['characters'][1]['title']='大黄蜂'
  with self.assertRaises(ValueError):characters.resolve('大黄蜂',data)
 def test_start_copies_only_research_and_refuses_overwrite(self):
  row=characters.resolve('bumblebee-2007')
  with tempfile.TemporaryDirectory() as tmp:
   target=characters.start(row,Path(tmp));self.assertFalse((target/'records/计划拆分.json').exists());self.assertFalse((target/'index.html').exists());self.assertFalse((target/'references/local').exists());self.assertEqual('draft',json.loads((target/'production.json').read_text())['status'])
   with self.assertRaises(FileExistsError):characters.start(row,Path(tmp))
 def test_nonhuman_start_uses_role_specific_ports(self):
  for slug,required in [('unicron-2023','equatorial_ring'),('ravage-2009','left_forepaw'),('laserbeak-2011','left_wing')]:
   with tempfile.TemporaryDirectory() as tmp:
    target=characters.start(characters.resolve(slug),Path(tmp),with_structure=True);ports=json.loads((target/'production.json').read_text())['rig']['requiredPorts'];self.assertIn(required,ports);self.assertNotIn('left_hand',ports)
 def test_fetch_local_hash_validation_does_not_touch_network(self):
  with tempfile.TemporaryDirectory() as tmp,patch.object(characters,'SERIES',Path(tmp)):
   folder=Path(tmp)/'example';(folder/'local').mkdir(parents=True);(folder/'local/image.jpg').write_bytes(b'good');source={'file':'local/image.jpg','url':'https://tf.takaratomy.co.jp/image.jpg','sha256':hashlib.sha256(b'good').hexdigest()};(folder/'sources.json').write_text(json.dumps({'sources':[source]}));row={'path':'example','sources':'example/sources.json'}
   with patch.object(characters,'urlopen') as network:self.assertEqual(1,characters.fetch(row));network.assert_not_called()
   source['url']='https://example.com/x';(folder/'sources.json').write_text(json.dumps({'sources':[source]}))
   with patch.object(characters,'urlopen') as network:
    with self.assertRaises(ValueError):characters.fetch(row)
    network.assert_not_called()

class PublicAssetInventoryTests(unittest.TestCase):
 def test_study_board_requires_traceable_sources_and_honest_rights_boundary(self):
  from check_transformer_publication import validate_publication, PREFIX
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);folder=root/PREFIX;folder.mkdir(parents=True)
   value=PREFIX+'references/boards/2007.jpg';(root/value).parent.mkdir(parents=True);raw=b'reduced board fixture';(root/value).write_bytes(raw)
   source={'sha256':'a'*64,'url':'https://example.com/original.jpg','sourcePage':'https://example.com/product','owner':'Original owner'}
   source_path=PREFIX+'characters/example/sources.json';(root/source_path).parent.mkdir(parents=True);(root/source_path).write_text(json.dumps({'sources':[source]}))
   item={'path':value,'sha256':hashlib.sha256(raw).hexdigest(),'kind':'reference-study','rights':'Third-party images, excluded from MIT','usage':'noncommercial-reference-research','rightsStatus':'redistribution-permission-not-established','sources':[{**source,'manifest':source_path,'fullFrame':True}]}
   def check(candidate):
    (folder/'publication.json').write_text(json.dumps({'assets':[candidate]}));return validate_publication([value],root)
   self.assertEqual([],check(item))
   for field,replacement in [('usage','commercial'),('rightsStatus','MIT'),('sources',[])]:
    changed=copy.deepcopy(item);changed[field]=replacement;self.assertTrue(check(changed))
   for field,replacement in [('url','https://example.com/other.jpg'),('owner','Unknown'),('fullFrame',False),('manifest','../private.json'),('sourcePage','file:///private')]:
    changed=copy.deepcopy(item);changed['sources'][0][field]=replacement;self.assertTrue(check(changed))
 def test_inventory_rejects_unlisted_or_changed_media_and_exif(self):
  from check_transformer_publication import validate_publication, PREFIX
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);folder=root/PREFIX;folder.mkdir(parents=True);value=PREFIX+'stills/own.jpg';(root/value).parent.mkdir();raw=b'generated image fixture';(root/value).write_bytes(raw);manifest={'assets':[{'path':value,'sha256':hashlib.sha256(raw).hexdigest(),'kind':'self-render','rights':'original rendering'}]};(folder/'publication.json').write_text(json.dumps(manifest));self.assertEqual([],validate_publication([value],root))
   self.assertTrue(validate_publication([],root));(root/value).write_bytes(b'changed');self.assertTrue(validate_publication([value],root))
   unknown=PREFIX+'original.jpg';(root/unknown).write_bytes(b'original');self.assertTrue(any('未登记' in e for e in validate_publication([value,unknown],root)))
   raw=b'Exif\x00\x00fixture';(root/value).write_bytes(raw);manifest['assets'][0]['sha256']=hashlib.sha256(raw).hexdigest();(folder/'publication.json').write_text(json.dumps(manifest));self.assertTrue(any('EXIF' in e for e in validate_publication([value],root)))

if __name__=='__main__':unittest.main()
