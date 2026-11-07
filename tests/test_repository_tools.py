import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
import subprocess

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from catalog import ROOT, get_case, load_catalog, recreation_plan, export_inputs
from check_repo import local_path, markdown_errors, publication_errors, validate_catalog


class RepositoryToolsTests(unittest.TestCase):
    def test_current_catalog_paths_and_command_entries(self):
        self.assertEqual([], validate_catalog(load_catalog(), ROOT))

    def test_unknown_case_and_variant_fail_instead_of_guessing(self):
        data = load_catalog()
        with self.assertRaises(ValueError):
            get_case(data, 'missing')
        with self.assertRaises(ValueError):
            get_case(data, 'oc8', 'missing')
        self.assertEqual('hy4-direct', get_case(data, 'oc8', 'hy4-direct')[1]['id'])

    def test_case_names_and_aliases_resolve_without_version_selection(self):
        data = load_catalog()
        queries = {'机械章鱼': 'oc8', 'Ｐｅｌａｇｏｓ ＯＣ－８': 'oc8', 'V8 发动机': 'v8',
                   '起落架': 'cessna337', '海滩兽': 'strandbeest', '沙虫': 'sandworm',
                   '水母': 'jellyfish', '六足机器人': 'hexapod', '蜜蜂': 'bee', '蝎子': 'scorpion',
                   '擎天柱': 'optimus-prime-2007', 'Optimus Prime': 'optimus-prime-2007',
                   '电影擎天柱': 'optimus-prime-2007'}
        with self.assertRaises(ValueError):
            get_case(data, 'Ｃ－０１')
        for query, expected in queries.items():
            with self.subTest(query=query):
                self.assertEqual(expected, get_case(data, query)[0]['id'])

    def test_ambiguous_aliases_are_rejected_instead_of_selecting_first(self):
        data = copy.deepcopy(load_catalog())
        data['cases'][1]['aliases'].append('机械章鱼')
        with self.assertRaisesRegex(ValueError, '不唯一'):
            get_case(data, '机械章鱼')
        self.assertTrue(any('名称冲突' in e for e in validate_catalog(data, ROOT)))

    def test_recreation_plan_excludes_existing_implementation_inputs(self):
        data = load_catalog()
        for case in data['cases']:
            with self.subTest(case=case['id']):
                plan = recreation_plan(case)
                self.assertNotIn('variants', plan)
                self.assertNotIn('commands', plan)
                self.assertEqual('independent', plan['defaults']['provenance'])
                forbidden = {v[k] for v in case['variants'] for k in ['live', 'film', 'spec', 'source', 'record']}
                self.assertTrue(forbidden.isdisjoint(plan['references']))
                remote=set()
                if plan.get('reference_manifest'):
                    manifest=json.loads((ROOT/plan['reference_manifest']).read_text())
                    remote={r['path'] for r in manifest['references']}
                self.assertTrue(all((ROOT / p).is_file() or p in remote for p in plan['references']))
        plan = recreation_plan(get_case(data, '机械章鱼')[0])
        self.assertEqual(9, len(plan['references']))
        self.assertTrue(all(Path(p).name[3:].startswith('原作-') for p in plan['references']))

    def test_export_copies_only_declared_inputs_and_wont_overwrite(self):
        case=get_case(load_catalog(),'oc8')[0]
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'inputs';payload=export_inputs(case,target)
            paths={r['path'] for r in payload['files']}
            self.assertIn(case['prompt'],paths)
            self.assertTrue(set(case['recreation']['references']).issubset(paths))
            self.assertNotIn('NOTICE.md',paths)
            self.assertFalse(any('/src/' in p or '/records/' in p or p.endswith('index.html') for p in paths))
            self.assertTrue((target/'TASK.md').is_file())
            with self.assertRaises(ValueError):export_inputs(case,target)

    def test_export_rejects_directory_traversal_and_symlink_escape(self):
        case=get_case(load_catalog(),'oc8')[0]
        with tempfile.TemporaryDirectory() as tmp:
            for value in ['../private.txt','/tmp/private.txt','series/机械复刻系列']:
                changed=copy.deepcopy(case);changed['prompt']=value
                with self.assertRaises(ValueError):export_inputs(changed,Path(tmp)/'inputs')
            link=Path(tmp)/'link';link.symlink_to(ROOT/'README.md')
            changed=copy.deepcopy(case);changed['prompt']='link'
            with self.assertRaises(ValueError):export_inputs(changed,Path(tmp)/'inputs',Path(tmp))

    def test_task_without_results_and_integrity_guards(self):
        import hashlib
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folder=root/'tasks/example';(folder/'references').mkdir(parents=True)
            (folder/'brief.md').write_text('new task');raw=b'original';(folder/'references/input.jpg').write_bytes(raw)
            (root/'docs').mkdir()
            common={'method':'docs/精细复刻流程.md','resources':'docs/共同输入与资源.md','source_notes':'docs/参考素材与许可.md'}
            for p in common.values():(root/p).write_text('generic')
            task={'id':'example','title':'Example','aliases':[],'series':'new','status':'ready','input_version':1,'brief':'tasks/example/brief.md','defaults':{'visual_goal':'fidelity','provenance':'independent'},'notes':'original only',**common,'references':[{'path':'tasks/example/references/input.jpg','sha256':hashlib.sha256(raw).hexdigest(),'kind':'original-reference'}]}
            (root/'tasks/index.json').write_text(json.dumps({'tasks':['tasks/example/input.json']}));(folder/'input.json').write_text(json.dumps(task));(root/'catalog.json').write_text(json.dumps({'schema_version':2,'cases':[]}))
            data=load_catalog(root);self.assertTrue(data['cases'][0]['task_only']);self.assertEqual([],validate_catalog(data,root))
            changed=copy.deepcopy(task);changed['source']='results/model.mjs';(folder/'input.json').write_text(json.dumps(changed));self.assertTrue(validate_catalog(load_catalog(root),root))
            (folder/'input.json').write_text(json.dumps(task));(folder/'references/input.jpg').write_bytes(b'changed');self.assertTrue(validate_catalog(load_catalog(root),root))
            with self.assertRaises(ValueError):export_inputs(load_catalog(root)['cases'][0],root/'exported',root)

    def test_task_rejects_internal_symlink_and_exports_mixed_reference_sources(self):
        import hashlib
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folder=root/'tasks/example';(folder/'references').mkdir(parents=True)
            (folder/'brief.md').write_text('task');(root/'docs').mkdir();(root/'templates').mkdir()
            for name in ['精细复刻流程.md','共同输入与资源.md','参考素材与许可.md','对照复刻约定.md','通用基础与约定.md']:(root/'docs'/name).write_text('method')
            (root/'templates/spec.md').write_text('blank')
            original=b'original';first=folder/'references/first.jpg';first.write_bytes(original)
            task={'id':'example','title':'Example','aliases':[],'series':'new','status':'ready','input_version':1,'brief':'tasks/example/brief.md','method':'docs/精细复刻流程.md','resources':'docs/共同输入与资源.md','source_notes':'docs/参考素材与许可.md','defaults':{'visual_goal':'fidelity','provenance':'independent'},'notes':'test','references':[{'path':'tasks/example/references/first.jpg','sha256':hashlib.sha256(original).hexdigest(),'kind':'original-reference','source_url':None},{'path':'tasks/example/references/local/second.jpg','sha256':'a'*64,'kind':'original-frame','source_url':'https://example.com/video','source_timestamp_seconds':6}]}
            (root/'tasks/index.json').write_text(json.dumps({'tasks':['tasks/example/input.json']}));(folder/'input.json').write_text(json.dumps(task));(root/'catalog.json').write_text(json.dumps({'schema_version':2,'cases':[]}))
            case=load_catalog(root)['cases'][0];self.assertEqual([],validate_catalog(load_catalog(root),root))
            exported=export_inputs(case,root/'export',root);self.assertEqual(['tasks/example/references/local/second.jpg'],exported['missing_media'])
            outcome=root/'series/result.jpg';outcome.parent.mkdir();outcome.write_bytes(original);first.unlink();first.symlink_to(outcome)
            self.assertTrue(any('符号链接' in e for e in validate_catalog(load_catalog(root),root)))
            with self.assertRaises(ValueError):export_inputs(load_catalog(root)['cases'][0],root/'export2',root)
            first.unlink();first.write_bytes(original);task['references'][1]['source_url']='file:///private';(folder/'input.json').write_text(json.dumps(task))
            self.assertTrue(any('HTTPS' in e for e in validate_catalog(load_catalog(root),root)))

    def test_every_registered_task_exports_without_results_and_reports_missing_media(self):
        data=load_catalog()
        with tempfile.TemporaryDirectory() as tmp:
            for case in data['cases']:
                with self.subTest(case=case['id']):
                    target=Path(tmp)/case['id'];payload=export_inputs(case,target)
                    self.assertFalse(any(p['path'].startswith('series/') for p in payload['files']))
                    task=json.loads((target/case['task_manifest']).read_text())
                    expected=[r['path'] for r in task['references'] if not (ROOT/r['path']).is_file()]
                    self.assertEqual(expected,payload['missing_media'])
                    if case['id']=='optimus-prime-2007':
                        self.assertEqual(8,len(task['references']))
                        self.assertTrue(all(isinstance(r.get('source_timestamp_seconds'),(int,float)) for r in task['references']))

    def test_load_catalog_rejects_task_index_symlink_even_inside_repository(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'tasks').mkdir();(root/'catalog.json').write_text(json.dumps({'schema_version':2,'cases':[]}))
            (root/'other.json').write_text(json.dumps({'tasks':[]}));(root/'tasks/index.json').symlink_to(root/'other.json')
            with self.assertRaises(ValueError):load_catalog(root)

    def test_recreation_reference_validation_catches_missing_and_nonmedia_inputs(self):
        data = copy.deepcopy(load_catalog())
        data['cases'][0]['recreation']['references'] = ['missing.jpg', 'AGENTS.md', '../outside.jpg']
        errors = validate_catalog(data, ROOT)
        self.assertTrue(any('missing.jpg' in e for e in errors))
        self.assertTrue(any('媒体文件' in e for e in errors))
        self.assertTrue(any('相对于仓库根目录' in e for e in errors))

    def test_recreate_cli_accepts_a_case_name_and_returns_only_new_task_inputs(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/catalog.py'),
                                 'recreate', '机械章鱼', '--json'],
                                cwd=ROOT, capture_output=True, text=True, check=True)
        plan = json.loads(result.stdout)
        self.assertEqual('oc8', plan['case_id'])
        self.assertEqual('tasks/oc8/brief.md', plan['prompt'])
        self.assertNotIn('variants', plan)
        self.assertNotIn('GLM版-互动页截图.jpg', result.stdout)

    def test_recreate_does_not_claim_all_references_are_absent(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/catalog.py'),
                                 'recreate', '机械章鱼'],
                                cwd=ROOT, capture_output=True, text=True, check=True)
        self.assertIn('缺失时按来源清单获取', result.stdout)
        self.assertNotIn('原始媒体不随仓库分发', result.stdout)

    def test_duplicate_and_missing_entries_are_rejected(self):
        data = copy.deepcopy(load_catalog())
        data['cases'].append(copy.deepcopy(data['cases'][0]))
        data['cases'][0]['variants'][0]['live'] = 'missing.html'
        errors = validate_catalog(data, ROOT)
        self.assertTrue(any('重复' in e for e in errors))
        self.assertTrue(any('missing.html' in e for e in errors))

    def test_paths_cannot_escape_repository(self):
        for value in ['../secret', '/tmp/secret', 'C:/secret']:
            with self.assertRaises(ValueError):
                local_path(ROOT, value)

    def test_links_decode_unicode_and_ignore_code_and_remote_urls(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '图.jpg').touch()
            doc = root / 'README.md'
            doc.write_text('[图](%E5%9B%BE.jpg) [远程](https://example.com/x)\n'
                           '```md\n[示例](missing.md)\n```\n[坏链](absent.md)', encoding='utf-8')
            self.assertEqual(1, len(markdown_errors(doc, root)))

    def test_generated_media_and_private_directories_are_ignored(self):
        for path in ['audio.wav','music.mp3','movie.mkv','asset.glb','scene.blend','tool.dmg','tasks/new/references/local/frame.jpg','private/credentials.json','local/bundle.zip','artifacts/preview.png']:
            with self.subTest(path=path):
                result=subprocess.run(['git','check-ignore','--no-index','-q','--',path],cwd=ROOT)
                self.assertEqual(0,result.returncode)
        for path in ['series/机械复刻系列/glm5.3-flash复刻/src/kit/sfx/samples/fs-258269-mouth-pop.ogg','series/机械复刻系列/glm5.3-flash复刻/src/upstream-teardown/sfx/samples/fs-258269-mouth-pop.ogg']:
            self.assertEqual(1,subprocess.run(['git','check-ignore','--no-index','-q','--',path],cwd=ROOT).returncode)

    def test_publication_rejects_secret_names_and_large_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.env').write_text('placeholder', encoding='utf-8')
            (root / '.env.example').write_text('KEY=example', encoding='utf-8')
            with (root / 'large.mp4').open('wb') as file:
                file.truncate(51 * 1024 * 1024)
            errors = publication_errors(['.env', '.env.example', 'large.mp4'], root)
            self.assertEqual(2, len(errors))

    def test_credential_scan_does_not_echo_matched_value(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            fake = 'ghp_' + 'x' * 36
            (root / 'example.md').write_text(fake, encoding='utf-8')
            errors = publication_errors(['example.md'], root)
            self.assertEqual(1, len(errors))
            self.assertNotIn(fake, errors[0])

    def test_markdown_unicode_heading_fragments(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'guide.md').write_text('# 使用说明\n## 使用说明', encoding='utf-8')
            doc = root / 'README.md'
            doc.write_text('# 自查\n[自](#自查) [一](guide.md#使用说明) [二](guide.md#使用说明-1) [错](guide.md#不存在)', encoding='utf-8')
            errors = markdown_errors(doc, root)
            self.assertEqual(1, len(errors))
            self.assertIn('不存在', errors[0])


if __name__ == '__main__':
    unittest.main()
