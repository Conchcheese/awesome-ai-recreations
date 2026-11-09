"""A 28-second cinematic edit of the full 50-second study timeline."""
CUTS=[(0,2,0,2,'IGNITION'),(2,4,5,7,'ARRIVAL'),(4,11,8,19,'TRANSFORMATION'),(11,13.5,19,23,'REVEAL'),(13.5,16,24,28,'REACTOR'),(16,18.5,29,33,'DEPLOYMENT'),(18.5,20,34,37,'ARTICULATION'),(20,23,38,42,'DISASSEMBLY'),(23,25,43,46,'REASSEMBLY'),(25,28,46,50,'OPTIMUS PRIME')]
DURATION=28
FPS=24
def source_at(t):
 for i,(a,b,c,d,name) in enumerate(CUTS):
  if a<=t<b or i==len(CUTS)-1:
   return c+(min(max(t,a),b)-a)/(b-a)*(d-c),i,name
 raise ValueError(t)
def movie_at(source):
 for a,b,c,d,name in CUTS:
  if c<=source<=d:return a+(source-c)/(d-c)*(b-a)
 return None
