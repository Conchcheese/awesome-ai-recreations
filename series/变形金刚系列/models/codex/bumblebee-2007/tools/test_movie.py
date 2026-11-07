"""Guard expensive renders against stale, incomplete and corrupt cache inputs."""
import hashlib, importlib.util, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image

spec=importlib.util.spec_from_file_location('bumblebee_movie',Path(__file__).with_name('movie.py'))
movie=importlib.util.module_from_spec(spec);spec.loader.exec_module(movie)

class RenderCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.out=self.root/'artifacts';self.frames=self.out/'frames/test';self.frames.mkdir(parents=True);(self.root/'src').mkdir()
        (self.root/'src/scene.py').write_text('original scene')
        settings={'engine':'CYCLES','samples':12,'width':20}
        self.config={**settings,'height':10,'fps':24,'duration':.125,'count':3,'frames':'artifacts/frames/test','fingerprint':hashlib.sha256(b'original scene'+json.dumps(settings).encode()).hexdigest()}
        self.save()
        for i in range(3):Image.new('RGB',(20,10)).save(self.frames/f'{i:05d}.png')
        self.p1=patch.object(movie,'BASE',self.root);self.p2=patch.object(movie,'OUT',self.out);self.p1.start();self.p2.start()
    def tearDown(self):self.p1.stop();self.p2.stop();self.temp.cleanup()
    def save(self):(self.out/'render-config.json').write_text(json.dumps(self.config))
    def test_complete_cache_is_accepted(self):self.assertEqual(movie.validate_frames()[0]['count'],3)
    def test_changed_scene_is_rejected(self):
        (self.root/'src/scene.py').write_text('changed geometry')
        with self.assertRaisesRegex(RuntimeError,'stale frames'):movie.validate_frames()
    def test_late_missing_frame_is_rejected(self):
        (self.frames/'00002.png').unlink()
        with self.assertRaisesRegex(RuntimeError,'missing frames'):movie.validate_frames()
    def test_incomplete_file_is_rejected(self):
        (self.frames/'00001.png').write_bytes(b'partial PNG')
        with self.assertRaises(OSError):movie.validate_frames()
    def test_wrong_resolution_is_rejected(self):
        Image.new('RGB',(10,10)).save(self.frames/'00002.png')
        with self.assertRaises(AssertionError):movie.validate_frames()
    def test_directory_escape_is_rejected(self):
        self.config['frames']='../outside';self.save()
        with self.assertRaisesRegex(RuntimeError,'escaped'):movie.validate_frames()

if __name__=='__main__':unittest.main(verbosity=2)
